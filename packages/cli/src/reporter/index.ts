/**
 * Terminal / JSON / agent reporters.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import type { ParityResult, ParityScoreBreakdown } from "../trace/schema.js";
import {
  formatCheckLine,
  formatKv,
  formatSection,
  formatStatusBadge,
  statusFromClassification,
} from "../cli/ux.js";

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
  /** When true, surface DEMO badges — never treat as production evidence */
  demo?: boolean;
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
  const demoTag = report.demo ? `  ${formatStatusBadge("DEMO")}` : "";
  lines.push(
    pc.bold(`EdgeMirror ${report.edgemirrorVersion}`) +
      pc.dim(`  run ${report.runId}`) +
      demoTag,
  );
  lines.push("");

  if (report.checks?.length) {
    lines.push(formatSection("Checks"));
    for (const check of report.checks) {
      lines.push(formatCheckLine(check.status, check.name, check.reason));
    }
    lines.push("");
  }

  lines.push(formatSection("Parity results"));
  if (report.results.length === 0) {
    lines.push(pc.dim("  (no tests executed)"));
  }
  for (const r of report.results) {
    const product = statusFromClassification(r.classification);
    const id = r.findingId ?? r.testId;
    lines.push(
      `  ${formatStatusBadge(product)}  ${pc.bold(id)}  ${classificationColor(r.classification)}  conf=${r.confidence.toFixed(2)}`,
    );
    for (const d of r.differences.slice(0, 8)) {
      lines.push(
        pc.dim(
          `      Δ ${d.path}: local=${JSON.stringify(d.local)} remote=${JSON.stringify(d.remote)}`,
        ),
      );
    }
    if (r.differences.length > 8) {
      lines.push(pc.dim(`      … ${r.differences.length - 8} more differences`));
    }
  }

  lines.push("");
  lines.push(formatSection("Score"));
  if (report.score.overall === null) {
    lines.push(formatKv("overall", `n/a (${report.score.calculation})`));
  } else {
    lines.push(formatKv("overall", `${(report.score.overall * 100).toFixed(1)}%`));
  }
  lines.push(formatKv("matched", String(report.score.matched)));
  lines.push(formatKv("divergent", String(report.score.divergent)));
  lines.push(formatKv("insufficient", String(report.score.insufficient)));
  lines.push(
    formatKv("remote not configured", String(report.score.remoteNotConfigured)),
  );

  if (report.remoteStatus === "REMOTE_NOT_CONFIGURED") {
    lines.push("");
    lines.push(
      `${formatStatusBadge("BLOCKED")}  Remote: REMOTE_NOT_CONFIGURED`,
    );
    if (report.remoteReason) {
      lines.push(pc.dim(`  ${report.remoteReason}`));
    }
  } else if (report.remoteStatus === "failed") {
    lines.push("");
    lines.push(`${formatStatusBadge("FAILED")}  Remote execution failed`);
    if (report.remoteReason) {
      lines.push(pc.dim(`  ${report.remoteReason}`));
    }
  }

  return lines.join("\n");
}

export function formatAgentReport(report: RunReport): string {
  const payload = {
    schemaVersion: report.schemaVersion,
    edgemirrorVersion: report.edgemirrorVersion,
    runId: report.runId,
    demo: Boolean(report.demo),
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
      productStatus: statusFromClassification(r.classification),
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
  const demoBanner = report.demo
    ? `<p class="demo">DEMO dataset — not production evidence</p>`
    : "";
  const rows = report.results
    .map((r) => {
      const product = statusFromClassification(r.classification);
      return `<tr>
<td><code>${r.findingId ?? ""}</code></td>
<td><code>${r.testId}</code></td>
<td><span class="st st-${product.toLowerCase()}">${product}</span></td>
<td><code>${r.classification}</code></td>
<td>${r.confidence}</td>
<td>${r.differences.length}</td>
</tr>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html lang="en" data-theme="dark"><head><meta charset="utf-8"/>
<title>EdgeMirror ${report.runId}</title>
<style>
:root{--ink:#e8eef2;--muted:#8a9aa6;--surface:#0c1116;--panel:#141b22;--line:#243040;--mirror:#3dbaa8;--verified:#3dbaa8;--divergent:#e07a6a;--blocked:#c4a56a;--failed:#e07a6a;--demo:#c47ac0;--font:IBM Plex Sans,Segoe UI,sans-serif;--mono:IBM Plex Mono,ui-monospace,monospace}
body{font-family:var(--font);margin:0;padding:2rem;background:var(--surface);color:var(--ink);line-height:1.45}
h1{font-size:1.25rem;margin:0 0 .25rem;letter-spacing:.02em}
.muted{color:var(--muted);font-size:.875rem}
.demo{border:1px dashed var(--demo);color:var(--demo);padding:.5rem .75rem;font-family:var(--mono);font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;margin:1rem 0}
table{border-collapse:collapse;width:100%;margin-top:1rem;font-size:.875rem}
th,td{border:1px solid var(--line);padding:.5rem .65rem;text-align:left;vertical-align:top}
th{background:var(--panel);font-weight:600;letter-spacing:.04em;text-transform:uppercase;font-size:.7rem;color:var(--muted)}
code{font-family:var(--mono);font-size:.8rem}
.st{font-family:var(--mono);font-size:.7rem;letter-spacing:.06em;border:1px solid currentColor;padding:.15rem .35rem}
.st-verified{color:var(--verified)}.st-divergent{color:var(--divergent)}.st-blocked{color:var(--blocked)}.st-failed{color:var(--failed)}.st-unknown{color:var(--muted)}.st-demo{color:var(--demo)}
.score{margin-top:1rem;font-family:var(--mono);font-size:.85rem}
</style></head><body>
<h1>EdgeMirror report</h1>
<p class="muted">run ${report.runId} · v${report.edgemirrorVersion}</p>
${demoBanner}
<p class="score">Score: ${report.score.overall === null ? "n/a" : `${(report.score.overall * 100).toFixed(1)}%`} · remote: ${report.remoteStatus}</p>
<table><thead><tr><th>Finding</th><th>Test</th><th>Status</th><th>Classification</th><th>Conf</th><th>Diffs</th></tr></thead>
<tbody>${rows || "<tr><td colspan=6>No results</td></tr>"}</tbody></table>
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
