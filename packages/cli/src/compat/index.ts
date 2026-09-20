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

export interface CompatOptions {
  cwd?: string;
  dates?: string[];
  filter?: string;
  quiet?: boolean;
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

  for (const date of dates) {
    const local = new LocalExecutionTarget({
      projectRoot: discovered.projectRoot,
      wranglerConfigPath: discovered.wranglerConfigPath,
      configurationFingerprint: {
        ...discovered.configurationFingerprint,
        compatibilityDate: date,
      },
      ownershipDir: join(artifacts, "ownership"),
      compatibilityDateOverride: date,
    });

    try {
      await local.prepare();
      for (const test of tests) {
        const trace = await local.execute(test);
        const httpStatus =
          trace.observations.http.status.availability === "captured"
            ? trace.observations.http.status.value
            : undefined;
        cells.push({
          compatibilityDate: date,
          testId: test.id,
          status: trace.status === "ok" ? "ok" : "error",
          httpStatus,
          reason: trace.statusReason,
        });
        if (trace.status !== "ok") failed = true;
      }
    } catch (err) {
      failed = true;
      cells.push({
        compatibilityDate: date,
        testId: tests[0]?.id ?? "unknown",
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await local.cleanup();
    }
  }

  void config;

  const report: CompatReport = {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId,
    projectRoot: discovered.projectRoot,
    baselineDate: baseline,
    dates,
    cells,
    note:
      "Local-only compatibility matrix. Remote/preview matrix requires CLOUDFLARE_API_TOKEN — not fabricated.",
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
