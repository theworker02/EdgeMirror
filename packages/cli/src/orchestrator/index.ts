/**
 * Orchestrates discover → execute local/remote → normalize → diff → evidence → report → cleanup.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  ensureArtifactsDir,
  loadConfig,
  type EdgeMirrorConfig,
} from "../config/index.js";
import { discoverProject, type DiscoveredProject } from "../discovery/index.js";
import { LocalExecutionTarget } from "../execution/local.js";
import { RemoteCloudflareExecutionTarget } from "../execution/remote.js";
import { PreviewExecutionTarget } from "../execution/preview.js";
import type { ExecutionTarget, RemoteBudgetState } from "../execution/types.js";
import { selectTests } from "../corpus/index.js";
import { buildParityResult, scoreParityResults } from "../diff/index.js";
import { redactDeep } from "../privacy/index.js";
import {
  createReceipt,
  nextFindingId,
  resetFindingCounter,
  writeReceipt,
  writeTrace,
} from "../provenance/index.js";
import {
  formatAgentReport,
  formatTerminalReport,
  writeReports,
  type CheckSummary,
  type ReportFormat,
  type RunReport,
} from "../reporter/index.js";
import type { ParityResult, ParityTest } from "../trace/schema.js";
import { EDGEMIRROR_VERSION } from "../version.js";

export interface OrchestratorOptions {
  cwd?: string;
  filter?: string;
  skipRemote?: boolean;
  usePreview?: boolean;
  previewUrl?: string;
  ci?: boolean;
  formats?: ReportFormat[];
  localOnly?: boolean;
  tests?: ParityTest[];
  runId?: string;
  quiet?: boolean;
}

export interface OrchestratorResult {
  report: RunReport;
  exitCode: number;
  artifactsDir: string;
  runDir: string;
}

function computeExitCode(
  results: ParityResult[],
  ci: boolean,
  localFailed: boolean,
  skipRemote: boolean,
): number {
  if (localFailed) return 2;
  // Intentional local-only: success if local executed
  if (skipRemote) {
    if (results.some((r) => r.localRuns === 0)) return 2;
    return 0;
  }
  if (!ci) {
    // Non-CI: remote-not-configured is not a hard failure
    if (results.some((r) => r.classification === "RUNTIME_DIVERGENCE")) return 1;
    if (
      results.some(
        (r) =>
          r.classification === "POSSIBLE_RUNTIME_DIVERGENCE" ||
          r.classification === "CONFIGURATION_DIFFERENCE",
      )
    ) {
      return 1;
    }
    return 0;
  }
  // CI mode
  if (results.some((r) => r.classification === "RUNTIME_DIVERGENCE")) return 1;
  if (
    results.every(
      (r) =>
        r.classification === "REMOTE_NOT_CONFIGURED" ||
        r.classification === "INSUFFICIENT_EVIDENCE",
    ) &&
    results.length > 0
  ) {
    return 3;
  }
  if (results.some((r) => r.classification === "INSUFFICIENT_EVIDENCE")) return 3;
  if (
    results.some(
      (r) =>
        r.classification === "POSSIBLE_RUNTIME_DIVERGENCE" ||
        r.classification === "APPLICATION_NONDETERMINISM",
    )
  ) {
    return 1;
  }
  return 0;
}

export async function runParitySuite(
  options: OrchestratorOptions = {},
): Promise<OrchestratorResult> {
  const cwd = options.cwd ?? process.cwd();
  const discovered = discoverProject(cwd);
  const config = loadConfig(discovered.projectRoot);
  const artifactsRoot = ensureArtifactsDir(discovered.projectRoot);
  const runId = options.runId ?? `run-${randomUUID().slice(0, 8)}`;
  const runDir = join(artifactsRoot, "runs", runId);
  mkdirSync(runDir, { recursive: true });
  mkdirSync(join(runDir, "traces"), { recursive: true });
  mkdirSync(join(runDir, "receipts"), { recursive: true });
  mkdirSync(join(runDir, "reports"), { recursive: true });

  const startedAt = new Date().toISOString();
  resetFindingCounter(0);

  const tests =
    options.tests ??
    selectTests({
      includeBuiltin: config.corpus.includeBuiltin,
      paths: config.corpus.paths,
      filter: options.filter,
      projectRoot: discovered.projectRoot,
    });

  const ownershipDir = join(artifactsRoot, "ownership");
  const budget: RemoteBudgetState = {
    maxRuns: config.remote.maxRuns,
    maxDurationMinutes: config.remote.maxDurationMinutes,
    runsUsed: 0,
    startedAt: Date.now(),
  };

  const execCtx = {
    projectRoot: discovered.projectRoot,
    wranglerConfigPath: discovered.wranglerConfigPath,
    configurationFingerprint: discovered.configurationFingerprint,
    ownershipDir,
    budget,
  };

  const local = new LocalExecutionTarget(execCtx);
  let remote: ExecutionTarget & {
    getPrepareStatus?: () => {
      configured: boolean;
      reason?: string;
      workersDevUrl?: string;
      previewUrl?: string;
    };
  };

  const skipRemote = Boolean(options.skipRemote || options.localOnly);
  if (skipRemote) {
    remote = new RemoteCloudflareExecutionTarget(execCtx);
  } else if (options.usePreview || options.previewUrl) {
    remote = new PreviewExecutionTarget(execCtx, {
      existingUrl: options.previewUrl,
    });
  } else {
    remote = new RemoteCloudflareExecutionTarget(execCtx);
  }

  const checks: CheckSummary[] = [];
  let remoteStatus: RunReport["remoteStatus"] = "skipped";
  let remoteReason: string | undefined;
  let localFailed = false;

  try {
    await local.prepare();
    checks.push({
      id: "local-runtime",
      name: "Local wrangler dev",
      status: "passed",
    });
  } catch (err) {
    localFailed = true;
    const message = err instanceof Error ? err.message : String(err);
    checks.push({
      id: "local-runtime",
      name: "Local wrangler dev",
      status: "failed",
      reason: message,
    });
    const report = finishReport({
      runId,
      startedAt,
      discovered,
      results: [],
      checks,
      remoteStatus: "skipped",
      remoteReason: "local prepare failed",
      formats: options.formats ?? ["terminal", "json"],
      runDir,
      quiet: options.quiet,
    });
    return {
      report,
      exitCode: 2,
      artifactsDir: artifactsRoot,
      runDir,
    };
  }

  if (skipRemote) {
    remoteStatus = "skipped";
    remoteReason = "Remote execution skipped (--local / --skip-remote)";
    checks.push({
      id: "remote",
      name: "Remote Cloudflare",
      status: "skipped",
      reason: remoteReason,
    });
  } else {
    await remote.prepare();
    const status = remote.getPrepareStatus?.();
    if (status && !status.configured) {
      remoteStatus = "REMOTE_NOT_CONFIGURED";
      remoteReason = status.reason;
      checks.push({
        id: "remote",
        name: options.usePreview ? "Preview URL" : "Remote Cloudflare",
        status: "unavailable",
        reason: "REMOTE_NOT_CONFIGURED",
        detail: status.reason,
      });
    } else {
      remoteStatus = "configured";
      checks.push({
        id: "remote",
        name: options.usePreview ? "Preview URL" : "Remote Cloudflare",
        status: "passed",
        detail: status?.previewUrl ?? status?.workersDevUrl,
      });
    }
  }

  const results: ParityResult[] = [];

  try {
    for (const test of tests) {
      const localTraceRaw = await local.execute(test);
      const remoteTraceRaw = skipRemote
        ? await createSkippedRemote(test, discovered, remoteReason ?? "skipped")
        : await remote.execute(test);

      const localRedacted = redactDeep(
        localTraceRaw,
        config.redaction.enabled ? config.redaction.patterns : [],
      );
      const remoteRedacted = redactDeep(
        remoteTraceRaw,
        config.redaction.enabled ? config.redaction.patterns : [],
      );
      localRedacted.value.redactions = localRedacted.redactions;
      remoteRedacted.value.redactions = remoteRedacted.redactions;

      const localPath = writeTrace(
        join(runDir, "traces"),
        localRedacted.value,
      );
      const remotePath = writeTrace(
        join(runDir, "traces"),
        remoteRedacted.value,
      );

      const findingId = nextFindingId("EM");
      const result = buildParityResult({
        testId: test.id,
        local: localRedacted.value,
        remote: remoteRedacted.value,
        expectedBehavior: test.expectedBehavior,
        findingId,
      });
      result.evidence.push(
        { kind: "artifact", description: "local trace", artifactPath: localPath },
        { kind: "artifact", description: "remote trace", artifactPath: remotePath },
      );

      const receipt = createReceipt({
        findingId,
        result,
        localTrace: localRedacted.value,
        remoteTrace: remoteRedacted.value,
        artifactPaths: [localPath, remotePath],
      });
      writeReceipt(join(runDir, "receipts"), receipt);
      results.push(result);
    }
  } finally {
    await local.cleanup();
    if (!skipRemote && config.remote.cleanup) {
      await remote.cleanup();
    }
  }

  const formats: ReportFormat[] =
    options.formats ??
    (config.reporters.formats as ReportFormat[]);

  const report = finishReport({
    runId,
    startedAt,
    discovered,
    results,
    checks,
    remoteStatus,
    remoteReason,
    formats,
    runDir,
    quiet: options.quiet,
  });

  const exitCode = computeExitCode(
    results,
    Boolean(options.ci),
    localFailed,
    skipRemote,
  );
  return { report, exitCode, artifactsDir: artifactsRoot, runDir };
}

async function createSkippedRemote(
  test: ParityTest,
  discovered: DiscoveredProject,
  reason: string,
) {
  const { createTrace, emptyObservations } = await import("../trace/factory.js");
  return createTrace({
    testId: test.id,
    target: "remote",
    status: "SKIPPED",
    statusReason: reason,
    configurationFingerprint: discovered.configurationFingerprint,
    observations: emptyObservations(),
  });
}

function finishReport(input: {
  runId: string;
  startedAt: string;
  discovered: DiscoveredProject;
  results: ParityResult[];
  checks: CheckSummary[];
  remoteStatus: RunReport["remoteStatus"];
  remoteReason?: string;
  formats: ReportFormat[];
  runDir: string;
  quiet?: boolean;
}): RunReport {
  const score = scoreParityResults(input.results);
  const report: RunReport = {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    projectRoot: input.discovered.projectRoot,
    results: input.results,
    score,
    remoteStatus: input.remoteStatus,
    remoteReason: input.remoteReason,
    checks: input.checks,
  };

  writeReports(join(input.runDir, "reports"), report, input.formats);
  // Also mirror to top-level reports for convenience
  writeReports(
    join(input.discovered.projectRoot, ".edgemirror", "reports"),
    report,
    input.formats,
  );
  writeFileSync(
    join(input.runDir, "summary.json"),
    JSON.stringify(report, null, 2),
    "utf8",
  );

  if (!input.quiet) {
    if (input.formats.includes("agent")) {
      console.log(formatAgentReport(report));
    } else {
      console.log(formatTerminalReport(report));
    }
  }

  return report;
}

export async function runLocalOnlySmoke(
  options: OrchestratorOptions = {},
): Promise<OrchestratorResult> {
  return runParitySuite({ ...options, localOnly: true, skipRemote: true });
}

export type { EdgeMirrorConfig };
