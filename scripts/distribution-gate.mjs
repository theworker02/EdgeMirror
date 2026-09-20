#!/usr/bin/env node
/**
 * Distribution-readiness gate
 *
 * Proves EdgeMirror works as an installed package — not only inside this monorepo:
 *   1. build the CLI
 *   2. npm pack → edgemirror-*.tgz
 *   3. create a blank Cloudflare Worker project in a temp directory
 *   4. npm install the tarball (+ wrangler peer)
 *   5. run edgemirror from node_modules/.bin (doctor + verify --local)
 *
 * Exit 0 only if all steps succeed. Does not publish to npm.
 */

import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CLI = join(ROOT, "packages", "cli");
const KEEP = process.env.EDGEMIRROR_DIST_KEEP === "1";

function log(step, msg) {
  console.log(`[distribution] ${step}: ${msg}`);
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opts,
  });
  if (result.status !== 0) {
    const detail = [
      `Command failed (${result.status}): ${cmd} ${args.join(" ")}`,
      result.stdout?.slice(-4000),
      result.stderr?.slice(-4000),
    ]
      .filter(Boolean)
      .join("\n");
    throw new Error(detail);
  }
  return result;
}

function findTarball(dir) {
  const files = readdirSync(dir).filter(
    (f) => f.startsWith("edgemirror-") && f.endsWith(".tgz"),
  );
  if (files.length === 0) {
    throw new Error(`No edgemirror-*.tgz found in ${dir}`);
  }
  files.sort();
  return join(dir, files[files.length - 1]);
}

function writeBlankWorker(projectDir) {
  mkdirSync(join(projectDir, "src"), { recursive: true });
  writeFileSync(
    join(projectDir, "package.json"),
    JSON.stringify(
      {
        name: "edgemirror-dist-smoke",
        private: true,
        version: "0.0.0",
        type: "module",
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    join(projectDir, "wrangler.jsonc"),
    JSON.stringify(
      {
        name: "edgemirror-dist-smoke",
        main: "src/index.ts",
        compatibility_date: "2025-04-01",
        workers_dev: true,
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    join(projectDir, "src", "index.ts"),
    `export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "") {
      return new Response("ok", { status: 200 });
    }
    if (url.pathname === "/health") {
      return Response.json({ status: "healthy" });
    }
    return new Response("Not Found", { status: 404 });
  },
};
`,
    "utf8",
  );
}

function assertBinExists(projectDir) {
  const win = process.platform === "win32";
  const bin = join(
    projectDir,
    "node_modules",
    ".bin",
    win ? "edgemirror.cmd" : "edgemirror",
  );
  if (!existsSync(bin)) {
    // npm on Windows may also create edgemirror without .cmd in some versions
    const alt = join(projectDir, "node_modules", ".bin", "edgemirror");
    if (!existsSync(alt)) {
      throw new Error(`Missing node_modules/.bin/edgemirror after install (${bin})`);
    }
  }
}

function assertPackageName(projectDir) {
  const pkgPath = join(projectDir, "node_modules", "edgemirror", "package.json");
  if (!existsSync(pkgPath)) {
    throw new Error("Installed package path node_modules/edgemirror missing");
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (pkg.name !== "edgemirror") {
    throw new Error(`Expected package name "edgemirror", got "${pkg.name}"`);
  }
  if (!pkg.bin?.edgemirror) {
    throw new Error("Installed package missing bin.edgemirror");
  }
}

async function main() {
  log("1/6", "build CLI");
  run("npm", ["run", "build", "-w", "edgemirror"], { cwd: ROOT });

  // Ensure LICENSE ships in the tarball
  const rootLicense = join(ROOT, "LICENSE");
  const cliLicense = join(CLI, "LICENSE");
  if (existsSync(rootLicense)) {
    copyFileSync(rootLicense, cliLicense);
  }

  log("2/6", "npm pack");
  const packDir = mkdtempSync(join(tmpdir(), "edgemirror-pack-"));
  run("npm", ["pack", "--pack-destination", packDir], { cwd: CLI });
  const tarball = findTarball(packDir);
  log("2/6", `tarball ${tarball}`);

  const projectDir = mkdtempSync(join(tmpdir(), "edgemirror-blank-"));
  log("3/6", `blank Worker project ${projectDir}`);
  writeBlankWorker(projectDir);

  log("4/6", "install tarball + wrangler into blank project");
  run(
    "npm",
    ["install", tarball, "wrangler@^4.135.0", "--no-fund", "--no-audit"],
    { cwd: projectDir },
  );
  assertPackageName(projectDir);
  assertBinExists(projectDir);

  // Critical: PATH must resolve edgemirror from THIS project only — not the monorepo.
  const binDir = join(projectDir, "node_modules", ".bin");
  const pathSep = process.platform === "win32" ? ";" : ":";
  const env = {
    ...process.env,
    PATH: `${binDir}${pathSep}${process.env.PATH ?? ""}`,
    // Prevent accidental use of monorepo linked tools
    npm_config_prefix: projectDir,
  };

  log("5/6", "edgemirror doctor (from node_modules/.bin)");
  const doctor = run("edgemirror", ["doctor"], { cwd: projectDir, env });
  const doctorOut = `${doctor.stdout}\n${doctor.stderr}`;
  if (!/Cloudflare Worker|Wrangler|compatibility/i.test(doctorOut)) {
    throw new Error(`doctor output did not look like a Workers project:\n${doctorOut}`);
  }

  log("6/6", "edgemirror verify --local (from node_modules/.bin)");
  const verify = run("edgemirror", ["verify", "--local"], {
    cwd: projectDir,
    env,
  });
  const verifyOut = `${verify.stdout}\n${verify.stderr}`;
  // Accept VERIFIED / parity / checks language; reject hard failures.
  if (/REMOTE_NOT_CONFIGURED/.test(verifyOut) && /error|failed/i.test(verifyOut) && verify.status !== 0) {
    // local-only should not require remote
  }
  if (verify.status !== 0 && verify.status !== undefined) {
    throw new Error(`verify --local exited ${verify.status}:\n${verifyOut}`);
  }

  console.log("");
  console.log("DISTRIBUTION GATE PASSED");
  console.log(`  package:   edgemirror (unscoped)`);
  console.log(`  tarball:   ${tarball}`);
  console.log(`  installed: ${projectDir}/node_modules/edgemirror`);
  console.log(`  bin:       ${binDir}/edgemirror`);
  console.log("");
  console.log("Not published. When ready: npm publish -w edgemirror --access public");
  console.log("(Canonical distribution: npmjs.com unscoped `edgemirror` — not GitHub Packages.)");

  if (!KEEP) {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(projectDir, { recursive: true, force: true });
  } else {
    console.log(`Kept artifacts (EDGEMIRROR_DIST_KEEP=1):`);
    console.log(`  ${packDir}`);
    console.log(`  ${projectDir}`);
  }
}

main().catch((err) => {
  console.error("DISTRIBUTION GATE FAILED");
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
