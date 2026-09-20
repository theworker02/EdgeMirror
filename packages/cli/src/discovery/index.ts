import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createFingerprint, emptyBindingSummary } from "../trace/factory.js";
import type {
  BindingSummary,
  ConfigurationFingerprint,
  EnvironmentFingerprint,
} from "../trace/schema.js";
import { EDGEMIRROR_VERSION } from "../version.js";
import { findUp } from "../config/index.js";
import { detectCloudflareAuth } from "../adapters/cloudflare/auth.js";

export interface DiscoveredProject {
  projectRoot: string;
  wranglerConfigPath: string;
  wranglerConfig: WranglerConfig;
  fingerprint: EnvironmentFingerprint;
  configurationFingerprint: ConfigurationFingerprint;
}

export interface WranglerConfig {
  name?: string;
  main?: string;
  compatibility_date?: string;
  compatibility_flags?: string[];
  vars?: Record<string, string>;
  kv_namespaces?: Array<{ binding: string; id?: string }>;
  d1_databases?: Array<{ binding: string; database_name?: string; database_id?: string }>;
  r2_buckets?: Array<{ binding: string; bucket_name?: string }>;
  durable_objects?: { bindings?: Array<{ name: string; class_name: string }> };
  queues?: {
    producers?: Array<{ binding: string; queue: string }>;
    consumers?: Array<{ queue: string }>;
  };
  services?: Array<{ binding: string; service: string }>;
  workflows?: Array<{ binding: string; name?: string; class_name?: string }>;
  hyperdrive?: Array<{ binding: string; id?: string }>;
  vectorize?: Array<{ binding: string; index_name?: string }>;
  ai?: { binding?: string };
  [key: string]: unknown;
}

function stripJsonc(input: string): string {
  // Remove // and /* */ comments while preserving strings roughly.
  let out = "";
  let i = 0;
  let inString = false;
  let stringChar = "";
  while (i < input.length) {
    const c = input[i];
    const next = input[i + 1];
    if (inString) {
      out += c;
      if (c === "\\" && i + 1 < input.length) {
        out += input[i + 1];
        i += 2;
        continue;
      }
      if (c === stringChar) inString = false;
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      i += 2;
      while (i < input.length && input[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i + 1 < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

export function parseWranglerConfig(path: string): WranglerConfig {
  const raw = readFileSync(path, "utf8");
  if (path.endsWith(".toml")) {
    return parseSimpleToml(raw);
  }
  const cleaned = stripJsonc(raw);
  return JSON.parse(cleaned) as WranglerConfig;
}

/** Minimal TOML subset for common wrangler.toml keys. */
function parseSimpleToml(raw: string): WranglerConfig {
  const result: WranglerConfig = {};
  const lines = raw.split(/\r?\n/);
  let section = "";
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }
    const kv = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    let value: unknown = kv[2].trim();
    if (typeof value === "string") {
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value === "true" || value === "false") {
        value = value === "true";
      } else if (/^\d+$/.test(value)) {
        value = Number(value);
      } else if (value.startsWith("[")) {
        try {
          value = JSON.parse(value.replace(/'/g, '"'));
        } catch {
          /* keep string */
        }
      }
    }
    if (!section) {
      (result as Record<string, unknown>)[key] = value;
    } else if (section === "durable_objects") {
      result.durable_objects = result.durable_objects ?? {};
      (result.durable_objects as Record<string, unknown>)[key] = value;
    } else {
      const bag = (result as Record<string, unknown>)[section];
      if (bag && typeof bag === "object" && !Array.isArray(bag)) {
        (bag as Record<string, unknown>)[key] = value;
      } else {
        (result as Record<string, unknown>)[section] = { [key]: value };
      }
    }
  }
  return result;
}

export function summarizeBindings(config: WranglerConfig): BindingSummary {
  const summary = emptyBindingSummary();
  summary.kv = config.kv_namespaces?.length ?? 0;
  summary.d1 = config.d1_databases?.length ?? 0;
  summary.r2 = config.r2_buckets?.length ?? 0;
  summary.durableObjects = config.durable_objects?.bindings?.length ?? 0;
  summary.queues =
    (config.queues?.producers?.length ?? 0) + (config.queues?.consumers?.length ?? 0);
  summary.serviceBindings = config.services?.length ?? 0;
  summary.workflows = config.workflows?.length ?? 0;
  summary.hyperdrive = config.hyperdrive?.length ?? 0;
  summary.vectorize = config.vectorize?.length ?? 0;
  summary.ai = config.ai?.binding ? 1 : 0;
  return summary;
}

function safeExec(cmd: string, args: string[]): string | undefined {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
      windowsHide: true,
    }).trim();
  } catch {
    return undefined;
  }
}

function detectWranglerVersion(projectRoot: string): string | undefined {
  const localBin =
    process.platform === "win32"
      ? join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js")
      : join(projectRoot, "node_modules", ".bin", "wrangler");
  // Walk up for workspace installs
  let dir = projectRoot;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "node_modules", "wrangler", "package.json");
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, "utf8")) as {
          version?: string;
        };
        if (pkg.version) return pkg.version;
      } catch {
        /* continue */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  void localBin;
  return (
    safeExec("npx", ["--no-install", "wrangler", "--version"]) ??
    safeExec("npx", ["wrangler", "--version"])
  );
}

function detectPackageManager(projectRoot: string): string | undefined {
  if (existsSync(join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(projectRoot, "yarn.lock"))) return "yarn";
  if (existsSync(join(projectRoot, "bun.lockb"))) return "bun";
  if (existsSync(join(projectRoot, "package-lock.json"))) return "npm";
  return undefined;
}

function detectCloudflareAuthLegacy(): EnvironmentFingerprint["cloudflareAuth"] {
  const detailed = detectCloudflareAuth();
  if (detailed.mode === "api_token" || detailed.mode === "api_key_email") {
    return "configured";
  }
  if (detailed.mode === "wrangler_oauth") return "unknown";
  return "missing";
}

export function findWranglerConfig(cwd: string): string | undefined {
  return findUp(cwd, [
    "wrangler.jsonc",
    "wrangler.json",
    "wrangler.toml",
  ]);
}

export function discoverProject(cwd = process.cwd()): DiscoveredProject {
  const wranglerConfigPath = findWranglerConfig(cwd);
  if (!wranglerConfigPath) {
    throw new EdgeMirrorDiscoveryError(
      "No Wrangler project detected",
      [
        "EdgeMirror looks for wrangler.jsonc, wrangler.json, or wrangler.toml.",
        "Run this command from a Cloudflare Worker project, or run `edgemirror init` first.",
      ],
    );
  }

  const projectRoot = dirname(wranglerConfigPath);
  const wranglerConfig = parseWranglerConfig(wranglerConfigPath);
  const bindings = summarizeBindings(wranglerConfig);

  const nodeVersion = process.version.replace(/^v/, "");
  const wranglerVersion = detectWranglerVersion(projectRoot);
  const workerdHint =
    safeExec("npx", ["--no-install", "workerd", "--version"]) ??
    (wranglerVersion ? "bundled-with-wrangler" : undefined);

  const fingerprint: EnvironmentFingerprint = {
    runtime: workerdHint ? "workerd" : "unknown",
    runtimeVersion: workerdHint === "bundled-with-wrangler" ? undefined : workerdHint,
    wrangler: wranglerVersion,
    node: nodeVersion,
    packageManager: detectPackageManager(projectRoot),
    compatibilityDate: wranglerConfig.compatibility_date,
    compatibilityFlags: wranglerConfig.compatibility_flags ?? [],
    entryPoint: wranglerConfig.main,
    workerName: wranglerConfig.name,
    bindings,
    wranglerConfigPath: relative(projectRoot, wranglerConfigPath) || wranglerConfigPath,
    projectRoot,
    cloudflareAuth: detectCloudflareAuthLegacy(),
    detectedAt: new Date().toISOString(),
    edgemirrorVersion: EDGEMIRROR_VERSION,
  };

  const configurationFingerprint = createFingerprint({
    projectRoot,
    workerName: wranglerConfig.name,
    entryPoint: wranglerConfig.main,
    compatibilityDate: wranglerConfig.compatibility_date,
    compatibilityFlags: wranglerConfig.compatibility_flags ?? [],
    bindings,
  });

  return {
    projectRoot,
    wranglerConfigPath,
    wranglerConfig,
    fingerprint,
    configurationFingerprint,
  };
}

export class EdgeMirrorDiscoveryError extends Error {
  readonly hints: string[];
  constructor(message: string, hints: string[] = []) {
    super(message);
    this.name = "EdgeMirrorDiscoveryError";
    this.hints = hints;
  }
}

export function formatDoctorReport(
  fingerprint: EnvironmentFingerprint,
  verbose = false,
): string {
  const lines: string[] = [];
  lines.push(`EdgeMirror ${fingerprint.edgemirrorVersion}`);
  lines.push("");
  lines.push("Project");
  lines.push(
    `  Cloudflare Worker ...... ${fingerprint.workerName ?? "detected"}`,
  );
  if (fingerprint.entryPoint) {
    lines.push(`  entry point ............ ${fingerprint.entryPoint}`);
  }
  if (fingerprint.wranglerConfigPath) {
    lines.push(`  wrangler config ........ ${fingerprint.wranglerConfigPath}`);
  }
  lines.push("");
  lines.push("Local runtime");
  lines.push(
    `  workerd ................ ${fingerprint.runtime === "workerd" ? "detected" : "not found"}`,
  );
  lines.push(
    `  Wrangler ............... ${fingerprint.wrangler ?? "not found"}`,
  );
  lines.push(`  Node.js ................ ${fingerprint.node}`);
  lines.push(
    `  package manager ........ ${fingerprint.packageManager ?? "unknown"}`,
  );
  lines.push(
    `  compatibility date ..... ${fingerprint.compatibilityDate ?? "unset"}`,
  );
  if (fingerprint.compatibilityFlags.length) {
    lines.push(
      `  compatibility flags .... ${fingerprint.compatibilityFlags.join(", ")}`,
    );
  }
  lines.push("");
  lines.push("Bindings");
  const b = fingerprint.bindings;
  lines.push(`  KV ..................... ${b.kv}`);
  lines.push(`  D1 ..................... ${b.d1}`);
  lines.push(`  R2 ..................... ${b.r2}`);
  lines.push(`  Durable Objects ........ ${b.durableObjects}`);
  lines.push(`  Queues ................. ${b.queues}`);
  lines.push(`  Service bindings ....... ${b.serviceBindings}`);
  lines.push(`  Workflows .............. ${b.workflows}`);
  lines.push(`  Hyperdrive ............. ${b.hyperdrive}`);
  lines.push(`  Vectorize .............. ${b.vectorize}`);
  lines.push(`  Workers AI ............. ${b.ai}`);
  lines.push("");
  lines.push("Remote environment");
  const authLabel =
    fingerprint.cloudflareAuth === "configured"
      ? "credentials present"
      : fingerprint.cloudflareAuth === "missing"
        ? "not configured"
        : "unknown (may use wrangler login)";
  lines.push(`  Cloudflare ............. ${authLabel}`);
  if (fingerprint.cloudflareAuth === "missing") {
    lines.push("  remote tests ........... REMOTE_NOT_CONFIGURED until authenticated");
  }
  if (verbose) {
    lines.push("");
    lines.push("Fingerprint (machine-readable)");
    lines.push(JSON.stringify(fingerprint, null, 2));
  }
  return lines.join("\n");
}
