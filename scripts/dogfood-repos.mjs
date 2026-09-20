#!/usr/bin/env node
/**
 * Quiet dogfood harness — clone public Workers repos and run local verify.
 *
 * Does NOT publish findings. Writes reports under .edgemirror/dogfood/.
 *
 *   node scripts/dogfood-repos.mjs
 *   node scripts/dogfood-repos.mjs --limit 5
 *
 * Default list is small, permissive, known Workers samples. Expand carefully.
 */

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "packages", "cli", "dist", "cli", "bin.js");

/** Curated starting set — expand after friction is fixed. */
const DEFAULT_REPOS = [
  {
    url: "https://github.com/cloudflare/workers-sdk.git",
    path: "templates/worker-router",
    note: "official template (subdir)",
  },
  // Additional public Workers projects can be appended here.
];

function run(cmd, args, cwd) {
  return spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
}

function findWrangler(dir) {
  for (const name of ["wrangler.jsonc", "wrangler.json", "wrangler.toml"]) {
    if (existsSync(join(dir, name))) return true;
  }
  return false;
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit"));
  const limit = limitArg
    ? Number(limitArg.includes("=") ? limitArg.split("=")[1] : process.argv[process.argv.indexOf("--limit") + 1])
    : DEFAULT_REPOS.length;

  if (!existsSync(BIN)) {
    const b = run("npm", ["run", "build", "-w", "edgemirror"], ROOT);
    if (b.status !== 0) {
      console.error(b.stderr);
      process.exitCode = 2;
      return;
    }
  }

  const outDir = join(ROOT, ".edgemirror", "dogfood");
  mkdirSync(outDir, { recursive: true });
  const results = [];

  const repos = DEFAULT_REPOS.slice(0, limit);
  console.log(
    `Dogfood: ${repos.length} repo(s). Local verify only. No auto-publish.`,
  );

  for (const repo of repos) {
    const entry = {
      url: repo.url,
      path: repo.path ?? ".",
      note: repo.note,
      status: "pending",
    };
    const cloneDir = join(tmpdir(), `edgemirror-dogfood-${Date.now()}`);
    try {
      console.log(`\nCloning ${repo.url} ...`);
      const clone = run(
        "git",
        ["clone", "--depth", "1", repo.url, cloneDir],
        ROOT,
      );
      if (clone.status !== 0) {
        entry.status = "clone_failed";
        entry.detail = clone.stderr?.slice(0, 500);
        results.push(entry);
        continue;
      }
      const projectDir = repo.path ? join(cloneDir, repo.path) : cloneDir;
      if (!findWrangler(projectDir)) {
        entry.status = "no_wrangler";
        entry.detail = "No wrangler.json(c)/toml in target path";
        results.push(entry);
        rmSync(cloneDir, { recursive: true, force: true });
        continue;
      }
      run("npm", ["install", "--no-fund", "--no-audit"], projectDir);
      const doctor = run("node", [BIN, "doctor"], projectDir);
      const verify = run("node", [BIN, "verify", "--local", "--ci"], projectDir);
      entry.status =
        verify.status === 0
          ? "verify_ok"
          : verify.status === 3
            ? "insufficient_evidence"
            : "verify_failed";
      entry.doctorExit = doctor.status;
      entry.verifyExit = verify.status;
      entry.stdoutTail = `${verify.stdout || ""}`.slice(-1500);
      results.push(entry);
      console.log(`  → ${entry.status} (exit ${verify.status})`);
    } catch (err) {
      entry.status = "error";
      entry.detail = err instanceof Error ? err.message : String(err);
      results.push(entry);
    } finally {
      try {
        rmSync(cloneDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  const reportPath = join(outDir, `report-${Date.now()}.json`);
  writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  console.log(`\nWrote ${reportPath}`);
  console.log(
    "Capture friction in docs/TROUBLESHOOTING.md before claiming launch readiness.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
