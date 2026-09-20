/**
 * Hardened process spawning — avoid shell metacharacter injection.
 *
 * Prefer `node <wrangler-bin>` so Windows never needs `shell: true` for .cmd shims
 * (Node concatenates argv when shell=true — DEP0190 / injection risk).
 */

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface WranglerInvocation {
  command: string;
  args: string[];
  shell: boolean;
  mode: "node-entry" | "npx-noshell" | "npx-shell-fallback";
}

const CLI_PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function candidateRoots(projectRoot: string): string[] {
  const roots = [projectRoot, CLI_PACKAGE_ROOT, process.cwd()];
  // Walk up from project for workspace installs.
  let dir = projectRoot;
  for (let i = 0; i < 8; i++) {
    roots.push(dir);
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [...new Set(roots.map((r) => join(r)))];
}

/**
 * Locate wrangler package.json from project, CLI package, or ancestors.
 */
export function findWranglerPackageJson(projectRoot: string): string | undefined {
  for (const root of candidateRoots(projectRoot)) {
    const candidate = join(root, "node_modules", "wrangler", "package.json");
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

function wranglerEntryFromPackage(pkgPath: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      bin?: string | Record<string, string>;
    };
    let binRel: string | undefined;
    if (typeof pkg.bin === "string") binRel = pkg.bin;
    else if (pkg.bin && typeof pkg.bin === "object") {
      binRel = pkg.bin.wrangler ?? Object.values(pkg.bin)[0];
    }
    if (!binRel) return undefined;
    const entry = join(dirname(pkgPath), binRel);
    return existsSync(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}

/** Locate npm's npx-cli.js for shell-free Windows invocation. */
function findNpxCliJs(): string | undefined {
  for (const root of [CLI_PACKAGE_ROOT, process.cwd()]) {
    const candidates = [
      join(root, "node_modules", "npm", "bin", "npx-cli.js"),
      join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js"),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  }
  return undefined;
}

export function resolveWranglerInvocation(
  projectRoot: string,
  wranglerArgs: string[],
): WranglerInvocation {
  const pkgPath = findWranglerPackageJson(projectRoot);
  if (pkgPath) {
    const entry = wranglerEntryFromPackage(pkgPath);
    if (entry) {
      return {
        command: process.execPath,
        args: [entry, ...wranglerArgs],
        shell: false,
        mode: "node-entry",
      };
    }
  }

  const npxCli = findNpxCliJs();
  if (npxCli) {
    return {
      command: process.execPath,
      args: [npxCli, "wrangler", ...wranglerArgs],
      shell: false,
      mode: "npx-noshell",
    };
  }

  // Last resort: npx binary. On Windows this may require shell; callers should
  // prefer installing wrangler locally so node-entry is used.
  return {
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["wrangler", ...wranglerArgs],
    shell: process.platform === "win32",
    mode: process.platform === "win32" ? "npx-shell-fallback" : "npx-noshell",
  };
}

export function spawnSafe(
  command: string,
  args: string[],
  options: SpawnOptions = {},
): ChildProcess {
  try {
    return spawn(command, args, {
      ...options,
      shell: options.shell ?? false,
      windowsHide: options.windowsHide ?? true,
    });
  } catch (err) {
    if (
      process.platform === "win32" &&
      !options.shell &&
      /\.cmd$/i.test(command)
    ) {
      return spawn(command, args, {
        ...options,
        shell: true,
        windowsHide: options.windowsHide ?? true,
      });
    }
    throw err;
  }
}

function mergeEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...extra,
    WRANGLER_SEND_METRICS: "false",
    CI: extra?.CI ?? process.env.CI ?? "true",
  };
}

/**
 * Spawn wrangler with the safest available invocation (prefer node entry, no shell).
 */
export function spawnWranglerSafe(
  projectRoot: string,
  wranglerArgs: string[],
  options: SpawnOptions = {},
): { child: ChildProcess; mode: WranglerInvocation["mode"] } {
  const invocation = resolveWranglerInvocation(projectRoot, wranglerArgs);
  const child = spawnSafe(invocation.command, invocation.args, {
    ...options,
    cwd: options.cwd ?? projectRoot,
    shell: invocation.shell,
    env: mergeEnv(options.env as NodeJS.ProcessEnv | undefined),
  });
  return { child, mode: invocation.mode };
}

/** Run wrangler to completion capturing stdout/stderr. */
export function runWranglerSafe(
  projectRoot: string,
  wranglerArgs: string[],
  options: SpawnOptions = {},
): Promise<{ code: number; stdout: string; stderr: string; mode: string }> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (code: number, usedMode: string) => {
      if (settled) return;
      settled = true;
      resolve({ code, stdout, stderr, mode: usedMode });
    };

    const attach = (child: ChildProcess, mode: string) => {
      child.stdout?.on("data", (c: Buffer) => {
        stdout += c.toString("utf8");
      });
      child.stderr?.on("data", (c: Buffer) => {
        stderr += c.toString("utf8");
      });
      child.on("close", (code) => finish(code ?? 1, mode));
      child.on("error", () => finish(1, mode));
    };

    try {
      const { child, mode } = spawnWranglerSafe(projectRoot, wranglerArgs, {
        ...options,
        stdio: ["ignore", "pipe", "pipe"],
      });
      attach(child, mode);
    } catch {
      finish(1, "spawn-failed");
    }
  });
}
