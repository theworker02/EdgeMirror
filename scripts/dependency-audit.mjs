#!/usr/bin/env node
/**
 * Dependency audit helper — runs `npm audit --json` when available and
 * writes a normalized summary for release review (Agent 6).
 *
 * Exit codes:
 *  0 — no high/critical (or audit unavailable / skipped)
 *  1 — high or critical findings present
 *  2 — tool failure
 */

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, "docs", "security");
mkdirSync(outDir, { recursive: true });

const skip = process.env.EDGEMIRROR_SKIP_NPM_AUDIT === "1";
if (skip) {
  const summary = {
    generatedAt: new Date().toISOString(),
    skipped: true,
    reason: "EDGEMIRROR_SKIP_NPM_AUDIT=1",
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    note: "Informational only — not a certification claim.",
  };
  writeFileSync(join(outDir, "dependency-audit.json"), JSON.stringify(summary, null, 2));
  console.log("Skipped npm audit (EDGEMIRROR_SKIP_NPM_AUDIT=1)");
  process.exit(0);
}

if (!existsSync(join(root, "package-lock.json"))) {
  console.warn("No package-lock.json — writing empty audit stub");
  writeFileSync(
    join(outDir, "dependency-audit.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        skipped: true,
        reason: "missing package-lock.json",
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--json", "--omit=dev"],
  {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
  },
);

let audit;
try {
  audit = JSON.parse(result.stdout || "{}");
} catch {
  console.error("Failed to parse npm audit JSON");
  console.error(result.stderr || result.stdout);
  process.exit(2);
}

const vulns = audit.metadata?.vulnerabilities ?? {
  info: 0,
  low: 0,
  moderate: 0,
  high: 0,
  critical: 0,
};

const summary = {
  generatedAt: new Date().toISOString(),
  skipped: false,
  critical: vulns.critical ?? 0,
  high: vulns.high ?? 0,
  moderate: vulns.moderate ?? 0,
  low: vulns.low ?? 0,
  info: vulns.info ?? 0,
  advisories: Object.entries(audit.vulnerabilities ?? {})
    .slice(0, 100)
    .map(([name, v]) => ({
      name,
      severity: v.severity,
      via: Array.isArray(v.via)
        ? v.via.map((x) => (typeof x === "string" ? x : x?.title)).filter(Boolean)
        : [],
      fixAvailable: Boolean(v.fixAvailable),
    })),
  note: "Informational dependency audit. Not a SOC 2 or certification claim.",
};

writeFileSync(join(outDir, "dependency-audit.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(outDir, "dependency-audit.raw.json"), JSON.stringify(audit, null, 2));

console.log(
  `Audit summary: critical=${summary.critical} high=${summary.high} moderate=${summary.moderate} low=${summary.low}`,
);

if (summary.critical > 0 || summary.high > 0) {
  process.exit(1);
}
process.exit(0);
