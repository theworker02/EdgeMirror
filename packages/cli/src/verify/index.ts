/**
 * High-level `edgemirror verify` workflow — auto-runs available checks.
 */

import { spawn } from "node:child_process";
import { join } from "node:path";
import { discoverZeroConfig } from "../discovery/zeroconfig.js";
import { runParitySuite } from "../orchestrator/index.js";
import type { ReportFormat, RunReport, CheckSummary } from "../reporter/index.js";
import {
  formatAgentReport,
  formatTerminalReport,
  writeReports,
} from "../reporter/index.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ensureArtifactsDir } from "../config/index.js";
import { EDGEMIRROR_VERSION } from "../version.js";
import { scoreParityResults } from "../diff/index.js";

export interface VerifyOptions {
  cwd?: string;
  format?: ReportFormat;
  vitest?: boolean;
  preview?: boolean;
  previewUrl?: string;
  localOnly?: boolean;
  ci?: boolean;
  filter?: string;
  quiet?: boolean;
}

function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env },
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

export async function runVerify(
  options: VerifyOptions = {},
): Promise<{ report: RunReport; exitCode: number; runDir: string }> {
  const cwd = options.cwd ?? process.cwd();
  const discovery = discoverZeroConfig(cwd);
  const runId = `verify-${randomUUID().slice(0, 8)}`;
  const artifactsRoot = ensureArtifactsDir(discovery.projectRoot);
  const runDir = join(artifactsRoot, "runs", runId);
  mkdirSync(runDir, { recursive: true });

  const checks: CheckSummary[] = [];
  const startedAt = new Date().toISOString();

  // Doctor / discovery check
  if (discovery.hasWrangler && discovery.worker) {
    checks.push({
      id: "discovery",
      name: "Project discovery",
      status: "passed",
      detail: discovery.worker.fingerprint.workerName,
    });
  } else {
    checks.push({
      id: "discovery",
      name: "Project discovery",
      status: "failed",
      reason: "No Wrangler project detected",
    });
    const report = buildVerifyReport({
      runId,
      startedAt,
      projectRoot: discovery.projectRoot,
      checks,
      remoteStatus: "skipped",
      results: [],
    });
    persistVerify(report, runDir, options);
    return { report, exitCode: 2, runDir };
  }

  // Optional Vitest
  if (options.vitest || discovery.vitest.detected) {
    if (!discovery.vitest.detected) {
      checks.push({
        id: "vitest",
        name: "Cloudflare Vitest",
        status: "skipped",
        reason: "Vitest not detected in project",
      });
    } else if (options.vitest === false) {
      checks.push({
        id: "vitest",
        name: "Cloudflare Vitest",
        status: "skipped",
        reason: "Skipped (not requested)",
      });
    } else if (options.vitest || discovery.vitest.cloudflarePool) {
      const pm =
        discovery.packageManager === "unknown" ? "npm" : discovery.packageManager;
      const script = discovery.vitest.script ?? "test";
      const result = await runCommand(pm, ["run", script, "--", "--run"], discovery.projectRoot);
      checks.push({
        id: "vitest",
        name: "Cloudflare Vitest",
        status: result.code === 0 ? "passed" : "failed",
        reason:
          result.code === 0
            ? discovery.vitest.cloudflarePool
              ? "Vitest pool workers"
              : "Vitest"
            : (result.stderr || result.stdout).slice(0, 500),
      });
    } else {
      checks.push({
        id: "vitest",
        name: "Cloudflare Vitest",
        status: "skipped",
        reason:
          "Vitest present but Cloudflare pool not confirmed; pass --vitest to force",
      });
    }
  }

  // Parity suite (local + remote/preview as available)
  const parity = await runParitySuite({
    cwd: discovery.projectRoot,
    filter: options.filter,
    usePreview: options.preview,
    previewUrl: options.previewUrl,
    localOnly: options.localOnly,
    skipRemote: options.localOnly,
    ci: options.ci,
    formats: [options.format ?? "terminal", "json"],
    runId: `${runId}-parity`,
    quiet: true,
  });

  for (const c of parity.report.checks ?? []) {
    checks.push(c);
  }

  const report = buildVerifyReport({
    runId,
    startedAt,
    projectRoot: discovery.projectRoot,
    checks,
    remoteStatus: parity.report.remoteStatus,
    remoteReason: parity.report.remoteReason,
    results: parity.report.results,
  });

  persistVerify(report, runDir, options);

  let exitCode = parity.exitCode;
  if (checks.some((c) => c.id === "vitest" && c.status === "failed")) {
    exitCode = exitCode === 0 ? 1 : exitCode;
  }
  return { report, exitCode, runDir };
}

function buildVerifyReport(input: {
  runId: string;
  startedAt: string;
  projectRoot: string;
  checks: CheckSummary[];
  remoteStatus: RunReport["remoteStatus"];
  remoteReason?: string;
  results: RunReport["results"];
}): RunReport {
  return {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    projectRoot: input.projectRoot,
    results: input.results,
    score: scoreParityResults(input.results),
    remoteStatus: input.remoteStatus,
    remoteReason: input.remoteReason,
    checks: input.checks,
  };
}

function persistVerify(
  report: RunReport,
  runDir: string,
  options: VerifyOptions,
): void {
  mkdirSync(join(runDir, "reports"), { recursive: true });
  const formats: ReportFormat[] = [
    options.format ?? "terminal",
    "json",
  ];
  if (options.format === "agent") {
    formats.push("agent");
  }
  writeReports(join(runDir, "reports"), report, [...new Set(formats)]);
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(report, null, 2));

  if (!options.quiet) {
    if (options.format === "agent") {
      console.log(formatAgentReport(report));
    } else if (options.format === "json") {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(formatTerminalReport(report));
    }
  }
}
