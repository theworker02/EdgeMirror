/**
 * Compatibility-date matrix testing — only real executions.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { discoverProject } from "../discovery/index.js";
import { ensureArtifactsDir, loadConfig } from "../config/index.js";
import { LocalExecutionTarget } from "../execution/local.js";
import { selectTests } from "../corpus/index.js";
import { EDGEMIRROR_VERSION } from "../version.js";
import { buildOptimizedMatrix } from "../supercharger/matrix.js";
import { runScheduler } from "../supercharger/scheduler.js";
import type { JobSpec, GovernorMode } from "../supercharger/types.js";

export interface CompatOptions {
  cwd?: string;
  dates?: string[];
  filter?: string;
  quiet?: boolean;
  /** Optional Supercharger matrix prune + scheduled local cells */
  supercharge?: boolean;
  mode?: GovernorMode;
}

export interface CompatCell {
  compatibilityDate: string;
  testId: string;
  status: "ok" | "error" | "skipped";
  httpStatus?: number;
  reason?: string;
}

export interface CompatReport {
  schemaVersion: "1.0";
  edgemirrorVersion: string;
  runId: string;
  projectRoot: string;
  baselineDate?: string;
  dates: string[];
  cells: CompatCell[];
  note: string;
}

/**
 * Run local-only matrix across compatibility dates.
 * Remote matrix requires credentials — when absent, only local is executed
 * and the report notes that honestly.
 */
export async function runCompatMatrix(
  options: CompatOptions = {},
): Promise<{ report: CompatReport; exitCode: number }> {
  const cwd = options.cwd ?? process.cwd();
  const discovered = discoverProject(cwd);
  const config = loadConfig(discovered.projectRoot);
  const artifacts = ensureArtifactsDir(discovered.projectRoot);
  const runId = `compat-${randomUUID().slice(0, 8)}`;
  const runDir = join(artifacts, "runs", runId);
  mkdirSync(runDir, { recursive: true });

  const baseline = discovered.wranglerConfig.compatibility_date;
  const dates =
    options.dates && options.dates.length > 0
      ? options.dates
      : baseline
        ? [baseline]
        : [];

  if (dates.length === 0) {
    const report: CompatReport = {
      schemaVersion: "1.0",
      edgemirrorVersion: EDGEMIRROR_VERSION,
      runId,
      projectRoot: discovered.projectRoot,
      baselineDate: baseline,
      dates: [],
      cells: [],
      note: "No compatibility dates provided and none set in wrangler config.",
    };
    writeFileSync(join(runDir, "compat.json"), JSON.stringify(report, null, 2));
    if (!options.quiet) {
      console.log(JSON.stringify(report, null, 2));
    }
    return { report, exitCode: 2 };
  }

  const tests = selectTests({
    includeBuiltin: true,
    filter: options.filter ?? "http-get-root",
  }).slice(0, 1);

  const cells: CompatCell[] = [];
  let failed = false;

  // Prune impossible combinations before execution (always safe; opt-in scheduling).
  const optimized = buildOptimizedMatrix({
    dates,
    testIds: tests.map((t) => t.id),
  });
  if (!options.quiet && optimized.pruned.length > 0) {
    console.log(optimized.note);
  }

  const workDates = [
    ...new Set(optimized.keep.map((c) => c.compatibilityDate)),
  ];
  if (workDates.length === 0) {
    for (const p of optimized.pruned) {
      cells.push({
        compatibilityDate: p.compatibilityDate,
        testId: p.testId,
        status: "skipped",
        reason: p.reason,
      });
    }
  } else if (options.supercharge && workDates.length > 1) {
    // Schedule independent date cells via Supercharger (each cell still prepares its own local runtime).
    const jobs: JobSpec[] = workDates.map((date) => ({
      id: `compat:${date}`,
      kind: "compat_cell" as const,
      name: `Compat ${date}`,
      priority: 2 as const,
      estimatedCu: 8,
      dependsOn: [],
      meta: { date },
    }));

    const schedule = await runScheduler({
      jobs,
      options: {
        enabled: true,
        mode: options.mode ?? "BALANCED",
      },
      execute: async (job) => {
        const date = String(job.meta?.date);
        const cellResults = await runCompatDate({
          date,
          tests,
          discovered,
          artifacts,
        });
        for (const c of cellResults) {
          cells.push(c);
          if (c.status === "error") failed = true;
        }
        return { cu: 8 };
      },
    });
    void schedule;
  } else {
    for (const date of workDates) {
      const cellResults = await runCompatDate({
        date,
        tests,
        discovered,
        artifacts,
      });
      for (const c of cellResults) {
        cells.push(c);
        if (c.status === "error") failed = true;
      }
    }
  }

  void config;

  const report: CompatReport = {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId,
    projectRoot: discovered.projectRoot,
    baselineDate: baseline,
    dates: workDates,
    cells,
    note:
      "Local-only compatibility matrix. Remote/preview matrix requires CLOUDFLARE_API_TOKEN — not fabricated." +
      (options.supercharge
        ? " Supercharger pruned impossible cells and may schedule independent dates."
        : ""),
  };

  writeFileSync(join(runDir, "compat.json"), JSON.stringify(report, null, 2));
  if (!options.quiet) {
    console.log(`EdgeMirror compat ${runId}`);
    console.log(`Baseline: ${baseline ?? "unset"}`);
    for (const cell of cells) {
      console.log(
        `  ${cell.compatibilityDate}  ${cell.testId}  ${cell.status}${cell.httpStatus ? ` HTTP ${cell.httpStatus}` : ""}${cell.reason ? ` — ${cell.reason}` : ""}`,
      );
    }
    console.log(report.note);
  }

  return { report, exitCode: failed ? 1 : 0 };
}

async function runCompatDate(input: {
  date: string;
  tests: ReturnType<typeof selectTests>;
  discovered: ReturnType<typeof discoverProject>;
  artifacts: string;
}): Promise<CompatCell[]> {
  const cells: CompatCell[] = [];
  const local = new LocalExecutionTarget({
    projectRoot: input.discovered.projectRoot,
    wranglerConfigPath: input.discovered.wranglerConfigPath,
    configurationFingerprint: {
      ...input.discovered.configurationFingerprint,
      compatibilityDate: input.date,
    },
    ownershipDir: join(input.artifacts, "ownership"),
    compatibilityDateOverride: input.date,
  });

  try {
    await local.prepare();
    for (const test of input.tests) {
      const trace = await local.execute(test);
      const httpStatus =
        trace.observations.http.status.availability === "captured"
          ? trace.observations.http.status.value
          : undefined;
      cells.push({
        compatibilityDate: input.date,
        testId: test.id,
        status: trace.status === "ok" ? "ok" : "error",
        httpStatus,
        reason: trace.statusReason,
      });
    }
  } catch (err) {
    cells.push({
      compatibilityDate: input.date,
      testId: input.tests[0]?.id ?? "unknown",
      status: "error",
      reason: err instanceof Error ? err.message : String(err),
    });
  } finally {
    await local.cleanup();
  }
  return cells;
}
