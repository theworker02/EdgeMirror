#!/usr/bin/env node
/**
 * Cloudflare live smoke — requires real credentials.
 *
 *   wrangler login
 *   # or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
 *   node scripts/cloudflare-live-smoke.mjs
 *
 * Runs pitch-demo (or verify --preview) against fixtures/basic-worker.
 * Never fabricates success when unauthenticated.
 */

import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(ROOT, "fixtures", "basic-worker");
const BIN = join(ROOT, "packages", "cli", "dist", "cli", "bin.js");

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  return spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
}

function hasEnvCreds() {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CLOUDFLARE_API_KEY,
  );
}

async function main() {
  const whoami = run("npx", ["wrangler", "whoami"], ROOT);
  const out = `${whoami.stdout}\n${whoami.stderr}`;
  const authenticated =
    whoami.status === 0 &&
    !/not authenticated|not logged in/i.test(out);

  if (!authenticated && !hasEnvCreds()) {
    console.error("CLOUDFLARE LIVE SMOKE BLOCKED");
    console.error("Not authenticated. Run: npx wrangler login");
    console.error("Or set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.");
    console.error("EdgeMirror will not invent preview/remote results.");
    process.exitCode = 2;
    return;
  }

  if (!existsSync(BIN)) {
    const build = run("npm", ["run", "build", "-w", "edgemirror"], ROOT);
    if (build.status !== 0) {
      console.error(build.stderr);
      process.exitCode = 2;
      return;
    }
  }

  const demo = run("node", [BIN, "pitch-demo"], FIXTURE);
  console.log(demo.stdout);
  if (demo.stderr) console.error(demo.stderr);

  if (demo.status !== 0) {
    console.error(`pitch-demo exited ${demo.status}`);
    process.exitCode = demo.status || 1;
    return;
  }

  if (/REMOTE_NOT_CONFIGURED/i.test(`${demo.stdout}\n${demo.stderr}`)) {
    console.error("Smoke reported REMOTE_NOT_CONFIGURED — auth did not unlock preview.");
    process.exitCode = 3;
    return;
  }

  console.log("\nCLOUDFLARE LIVE SMOKE PASSED");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
