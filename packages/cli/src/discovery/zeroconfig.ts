/**
 * Extended zero-config project discovery for Phase 2 verify workflow.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  discoverProject,
  findWranglerConfig,
  type DiscoveredProject,
} from "./index.js";

export interface PackageJsonShape {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface ZeroConfigDiscovery {
  projectRoot: string;
  hasWrangler: boolean;
  wranglerConfigPath?: string;
  packageJsonPath?: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  worker?: DiscoveredProject;
  vitest: {
    detected: boolean;
    configPath?: string;
    cloudflarePool: boolean;
    script?: string;
  };
  vite: {
    detected: boolean;
    configPath?: string;
  };
  typescript: {
    detected: boolean;
    tsconfigPath?: string;
  };
  testScripts: string[];
  inferredChecks: Array<{
    id: string;
    available: boolean;
    reason?: string;
  }>;
}

function readJsonSafe(path: string): PackageJsonShape | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJsonShape;
  } catch {
    return undefined;
  }
}

function detectPackageManager(root: string): ZeroConfigDiscovery["packageManager"] {
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(root, "yarn.lock"))) return "yarn";
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock")))
    return "bun";
  if (existsSync(join(root, "package-lock.json"))) return "npm";
  return "unknown";
}

function findFirst(root: string, names: string[]): string | undefined {
  for (const name of names) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

function detectCloudflareVitest(root: string, pkg?: PackageJsonShape): {
  detected: boolean;
  configPath?: string;
  cloudflarePool: boolean;
  script?: string;
} {
  const configPath = findFirst(root, [
    "vitest.config.ts",
    "vitest.config.mts",
    "vitest.config.js",
    "vitest.config.mjs",
    "vitest.workspace.ts",
  ]);
  const deps = {
    ...pkg?.dependencies,
    ...pkg?.devDependencies,
  };
  const hasCfVitest = Boolean(
    deps?.["@cloudflare/vitest-pool-workers"] ||
      deps?.["@cloudflare/vitest-pool-workers".toString()],
  );
  let cloudflarePool = hasCfVitest;
  if (configPath) {
    try {
      const raw = readFileSync(configPath, "utf8");
      if (/cloudflare|vitest-pool-workers|workers/i.test(raw)) {
        cloudflarePool = true;
      }
    } catch {
      /* ignore */
    }
  }
  const script =
    pkg?.scripts &&
    Object.entries(pkg.scripts).find(
      ([, v]) => /vitest/.test(v) || /test/.test(v),
    )?.[0];

  return {
    detected: Boolean(configPath) || Boolean(deps?.vitest),
    configPath,
    cloudflarePool,
    script,
  };
}

function hasCloudflareAuthEnv(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CLOUDFLARE_API_KEY ||
      process.env.CLOUDFLARE_EMAIL,
  );
}

/**
 * Discover a project without requiring wrangler (for verify zero-config UX).
 * When wrangler is present, also attach full worker discovery.
 */
export function discoverZeroConfig(cwd = process.cwd()): ZeroConfigDiscovery {
  const wranglerConfigPath = findWranglerConfig(cwd);
  const root = wranglerConfigPath
    ? dirname(wranglerConfigPath)
    : existsSync(join(cwd, "package.json"))
      ? cwd
      : cwd;

  const packageJsonPath = existsSync(join(root, "package.json"))
    ? join(root, "package.json")
    : undefined;
  const pkg = packageJsonPath ? readJsonSafe(packageJsonPath) : undefined;

  let worker: DiscoveredProject | undefined;
  let hasWrangler = false;
  if (wranglerConfigPath) {
    try {
      worker = discoverProject(cwd);
      hasWrangler = true;
    } catch {
      hasWrangler = Boolean(wranglerConfigPath);
    }
  }

  const vitest = detectCloudflareVitest(root, pkg);
  const viteConfig = findFirst(root, [
    "vite.config.ts",
    "vite.config.mts",
    "vite.config.js",
    "vite.config.mjs",
  ]);
  const tsconfigPath = findFirst(root, [
    "tsconfig.json",
    "tsconfig.worker.json",
    "tsconfig.app.json",
  ]);

  const testScripts = pkg?.scripts
    ? Object.entries(pkg.scripts)
        .filter(([k, v]) => /^test/.test(k) || /vitest|jest|mocha/.test(v))
        .map(([k]) => k)
    : [];

  const auth = hasCloudflareAuthEnv();
  const inferredChecks: ZeroConfigDiscovery["inferredChecks"] = [
    {
      id: "doctor",
      available: hasWrangler,
      reason: hasWrangler ? undefined : "No wrangler config found",
    },
    {
      id: "local-parity",
      available: hasWrangler,
      reason: hasWrangler ? undefined : "Requires wrangler project",
    },
    {
      id: "remote-parity",
      available: hasWrangler && auth,
      reason: !hasWrangler
        ? "Requires wrangler project"
        : auth
          ? undefined
          : "REMOTE_NOT_CONFIGURED: set CLOUDFLARE_API_TOKEN",
    },
    {
      id: "preview",
      available: hasWrangler && auth,
      reason: !hasWrangler
        ? "Requires wrangler project"
        : auth
          ? undefined
          : "REMOTE_NOT_CONFIGURED: set CLOUDFLARE_API_TOKEN",
    },
    {
      id: "vitest",
      available: vitest.detected,
      reason: vitest.detected
        ? vitest.cloudflarePool
          ? "Cloudflare Vitest pool detected"
          : "Vitest detected (no CF pool confirmed)"
        : "No Vitest config or dependency found",
    },
  ];

  return {
    projectRoot: worker?.projectRoot ?? root,
    hasWrangler,
    wranglerConfigPath: worker?.wranglerConfigPath ?? wranglerConfigPath,
    packageJsonPath,
    packageManager: detectPackageManager(root),
    worker,
    vitest,
    vite: {
      detected: Boolean(viteConfig) || Boolean(pkg?.devDependencies?.vite),
      configPath: viteConfig,
    },
    typescript: {
      detected: Boolean(tsconfigPath),
      tsconfigPath,
    },
    testScripts,
    inferredChecks,
  };
}

export function listProjectFiles(root: string, max = 50): string[] {
  try {
    return readdirSync(root).slice(0, max);
  } catch {
    return [];
  }
}
