/**
 * Shared Wrangler/workerd helpers for Cloudflare adapters.
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { runWranglerSafe } from "../../security/spawn.js";

export function runWrangler(
  args: string[],
  cwd: string,
  _env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return runWranglerSafe(cwd, args);
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
