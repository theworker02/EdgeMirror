/**
 * Terminal / JSON / agent reporters.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import type { ParityResult, ParityScoreBreakdown } from "../trace/schema.js";

export type ReportFormat = "terminal" | "json" | "html" | "agent";

export interface RunReport {
  schemaVersion: "1.0";
  edgemirrorVersion: string;
  runId: string;
  startedAt: string;
  finishedAt: string;
  projectRoot: string;
  results: ParityResult[];
  score: ParityScoreBreakdown;
  remoteStatus: "configured" | "REMOTE_NOT_CONFIGURED" | "failed" | "skipped";
  remoteReason?: string;
  checks?: CheckSummary[];
}

export interface CheckSummary {
  id: string;
  name: string;
  status: "passed" | "failed" | "skipped" | "unavailable";
  reason?: string;
  detail?: string;
}

function classificationColor(c: ParityResult["classification"]): string {
  switch (c) {
    case "MATCH":
    case "EXPECTED_DIFFERENCE":
      return pc.green(c);
    case "REMOTE_NOT_CONFIGURED":
      return pc.yellow(c);
    case "INSUFFICIENT_EVIDENCE":
      return pc.yellow(c);
    case "CONFIGURATION_DIFFERENCE":
    case "APPLICATION_NONDETERMINISM":
      return pc.cyan(c);
    default:
      return pc.red(c);
  }
}

export function formatTerminalReport(report: RunReport): string {
  const lines: string[] = [];
  lines.push(pc.bold(`EdgeMirror ${report.edgemirrorVersion}`) + `  run ${report.runId}`);
  lines.push("");

  if (report.checks?.length) {
    lines.push(pc.bold("Checks"));
    for (const check of report.checks) {
      const badge =
        check.status === "passed"
          ? pc.green("PASS")
          : check.status === "failed"
            ? pc.red("FAIL")
            : check.status === "unavailable"
              ? pc.yellow("N/A")
              : pc.dim("SKIP");
      lines.push(`  [${badge}] ${check.name}${check.reason ? ` — ${check.reason}` : ""}`);
    }
    lines.push("");
  }

  lines.push(pc.bold("Parity results"));
  if (report.results.length === 0) {
    lines.push("  (no tests executed)");
  }
  for (const r of report.results) {
    lines.push(
      `  ${r.findingId ?? r.testId}  ${classificationColor(r.classification)}  conf=${r.confidence.toFixed(2)}`,
    );
    for (const d of r.differences.slice(0, 5)) {
      lines.push(
        pc.dim(
          `    Δ ${d.path}: local=${JSON.stringify(d.local)} remote=${JSON.stringify(d.remote)}`,
        ),
      );
    }
  }

  lines.push("");
  lines.push(pc.bold("Score"));
  if (report.score.overall === null) {
    lines.push(`  overall ............... n/a (${report.score.calculation})`);
  } else {
    lines.push(
      `  overall ............... ${(report.score.overall * 100).toFixed(1)}%`,
    );
  }
  lines.push(`  matched ............... ${report.score.matched}`);
  lines.push(`  divergent ............. ${report.score.divergent}`);
  lines.push(`  insufficient .......... ${report.score.insufficient}`);
  lines.push(
    `  remote not configured .. ${report.score.remoteNotConfigured}`,
  );

  if (report.remoteStatus === "REMOTE_NOT_CONFIGURED") {
    lines.push("");
    lines.push(pc.yellow("Remote: REMOTE_NOT_CONFIGURED"));
    if (report.remoteReason) {
      lines.push(pc.dim(report.remoteReason));
    }
  }

  return lines.join("\n");
}

export function formatAgentReport(report: RunReport): string {
  const payload = {
    schemaVersion: report.schemaVersion,
    edgemirrorVersion: report.edgemirrorVersion,
    runId: report.runId,
    remoteStatus: report.remoteStatus,
    remoteReason: report.remoteReason,
    score: {
      overall: report.score.overall,
      matched: report.score.matched,
      divergent: report.score.divergent,
      insufficient: report.score.insufficient,
      remoteNotConfigured: report.score.remoteNotConfigured,
    },
    checks: report.checks?.map((c) => ({
      id: c.id,
      status: c.status,
      reason: c.reason,
    })),
    findings: report.results.map((r) => ({
      id: r.findingId ?? r.testId,
      testId: r.testId,
      classification: r.classification,
      confidence: r.confidence,
      differenceCount: r.differences.length,
      topDifferences: r.differences.slice(0, 3).map((d) => d.path),
    })),
  };
  return JSON.stringify(payload);
}

export function formatJsonReport(report: RunReport): string {
  return JSON.stringify(report, null, 2);
}

export function formatHtmlReport(report: RunReport): string {
  const rows = report.results
    .map(
      (r) =>
        `<tr><td>${r.findingId ?? ""}</td><td>${r.testId}</td><td>${r.classification}</td><td>${r.confidence}</td><td>${r.differences.length}</td></tr>`,
    )
    .join("\n");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>EdgeMirror ${report.runId}</title>
<style>
body{font-family:ui-sans-serif,system-ui,sans-serif;margin:2rem;background:#0b1220;color:#e8eefc}
table{border-collapse:collapse;width:100%}
th,td{border:1px solid #334;padding:.5rem;text-align:left}
th{background:#152038}
.muted{opacity:.7}
</style></head><body>
<h1>EdgeMirror report</h1>
<p class="muted">run ${report.runId} · v${report.edgemirrorVersion}</p>
<p>Score: ${report.score.overall === null ? "n/a" : `${(report.score.overall * 100).toFixed(1)}%`} · remote: ${report.remoteStatus}</p>
<table><thead><tr><th>Finding</th><th>Test</th><th>Classification</th><th>Confidence</th><th>Diffs</th></tr></thead>
<tbody>${rows || "<tr><td colspan=5>No results</td></tr>"}</tbody></table>
</body></html>`;
}

export function writeReports(
  reportsDir: string,
  report: RunReport,
  formats: ReportFormat[],
): Record<string, string> {
  mkdirSync(reportsDir, { recursive: true });
  const written: Record<string, string> = {};
  for (const format of formats) {
    let content: string;
    let ext: string;
    switch (format) {
      case "json":
        content = formatJsonReport(report);
        ext = "json";
        break;
      case "html":
        content = formatHtmlReport(report);
        ext = "html";
        break;
      case "agent":
        content = formatAgentReport(report);
        ext = "agent.json";
        break;
      default:
        content = formatTerminalReport(report);
        ext = "txt";
    }
    const path = join(reportsDir, `report.${ext}`);
    writeFileSync(path, content, "utf8");
    written[format] = path;
  }
  return written;
}
