/**
 * Shared Wrangler/workerd helpers for Cloudflare adapters.
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

export function resolveWranglerBin(): { cmd: string; argsPrefix: string[] } {
  return {
    cmd: process.platform === "win32" ? "npx.cmd" : "npx",
    argsPrefix: ["wrangler"],
  };
}

export function runWrangler(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const { cmd, argsPrefix } = resolveWranglerBin();
    const child = spawn(cmd, [...argsPrefix, ...args], {
      cwd,
      env: { ...env, WRANGLER_SEND_METRICS: "false", CI: "true" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString("utf8");
    });
    child.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString("utf8");
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

/**
 * Write a temporary wrangler JSONC overlay that forces compatibility_date
 * (and optional name) while preserving the rest of the source config.
 */
export function writeCompatDateOverlay(opts: {
  sourceConfigPath: string;
  overlayDir: string;
  compatibilityDate: string;
  name?: string;
}): string {
  mkdirSync(opts.overlayDir, { recursive: true });
  const overlayPath = join(opts.overlayDir, "wrangler.jsonc");
  const source = readFileSync(opts.sourceConfigPath, "utf8");

  if (
    opts.sourceConfigPath.endsWith(".json") ||
    opts.sourceConfigPath.endsWith(".jsonc")
  ) {
    let out = source;
    if (/"compatibility_date"\s*:/.test(out)) {
      out = out.replace(
        /"compatibility_date"\s*:\s*"[^"]*"/,
        `"compatibility_date": "${opts.compatibilityDate}"`,
      );
    } else {
      out = out.replace(
        /\{/,
        `{\n  "compatibility_date": "${opts.compatibilityDate}",`,
      );
    }
    if (opts.name) {
      if (/"name"\s*:/.test(out)) {
        out = out.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${opts.name}"`);
      } else {
        out = out.replace(/\{/, `{\n  "name": "${opts.name}",`);
      }
    }
    writeFileSync(overlayPath, out, "utf8");
    return overlayPath;
  }

  // TOML → minimal JSONC overlay; resolve main relative to project.
  const mainMatch = source.match(/^\s*main\s*=\s*"([^"]+)"/m);
  const nameMatch = source.match(/^\s*name\s*=\s*"([^"]+)"/m);
  const payload = {
    name: opts.name ?? nameMatch?.[1] ?? "edgemirror-compat",
    main: mainMatch?.[1] ?? "src/index.ts",
    compatibility_date: opts.compatibilityDate,
    workers_dev: true,
  };
  writeFileSync(overlayPath, JSON.stringify(payload, null, 2), "utf8");
  return overlayPath;
}

export function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

export function projectDirFromConfig(configPath: string): string {
  return dirname(configPath);
}
