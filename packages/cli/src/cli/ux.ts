/**
 * Shared CLI visual helpers — hierarchy and status language without hiding evidence.
 */

import pc from "picocolors";
import { EDGEMIRROR_VERSION } from "../version.js";

export type CliStatus =
  | "VERIFIED"
  | "DIVERGENT"
  | "RUNNING"
  | "UNKNOWN"
  | "STALE"
  | "BLOCKED"
  | "FAILED"
  | "DEMO";

const STATUS_COLOR: Record<CliStatus, (s: string) => string> = {
  VERIFIED: pc.green,
  DIVERGENT: pc.red,
  RUNNING: pc.cyan,
  UNKNOWN: pc.dim,
  STALE: pc.yellow,
  BLOCKED: pc.yellow,
  FAILED: pc.red,
  DEMO: pc.magenta,
};

export function formatStatusBadge(status: CliStatus): string {
  const paint = STATUS_COLOR[status];
  return paint(`[${status}]`);
}

export function statusFromClassification(classification: string): CliStatus {
  switch (classification) {
    case "MATCH":
    case "EXPECTED_DIFFERENCE":
      return "VERIFIED";
    case "POSSIBLE_RUNTIME_DIVERGENCE":
    case "RUNTIME_DIVERGENCE":
    case "CONFIGURATION_DIFFERENCE":
    case "UNEXPECTED_DIFFERENCE":
      return "DIVERGENT";
    case "REMOTE_NOT_CONFIGURED":
      return "BLOCKED";
    case "INSUFFICIENT_EVIDENCE":
    case "APPLICATION_NONDETERMINISM":
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

export function formatBanner(opts?: {
  subtitle?: string;
  demo?: boolean;
}): string {
  const lines: string[] = [];
  lines.push("");
  if (opts?.demo) {
    lines.push(pc.bold(pc.magenta(`EdgeMirror ${EDGEMIRROR_VERSION}`)) + pc.magenta("  DEMO"));
  } else {
    lines.push(pc.bold(`EdgeMirror ${EDGEMIRROR_VERSION}`));
  }
  lines.push(
    pc.dim(
      opts?.subtitle ??
        "Production parity for Cloudflare Workers — independent OSS, not affiliated with Cloudflare, Inc.",
    ),
  );
  lines.push("");
  return lines.join("\n");
}

export function formatSection(title: string): string {
  return pc.bold(title);
}

/** Pad label to a fixed column for doctor/score tables. */
export function formatKv(label: string, value: string, width = 24): string {
  const dots = ".".repeat(Math.max(2, width - label.length));
  return `  ${label} ${dots} ${value}`;
}

export function formatCheckLine(
  status: "passed" | "failed" | "skipped" | "unavailable",
  name: string,
  reason?: string,
): string {
  const badge =
    status === "passed"
      ? formatStatusBadge("VERIFIED")
      : status === "failed"
        ? formatStatusBadge("FAILED")
        : status === "unavailable"
          ? formatStatusBadge("BLOCKED")
          : pc.dim("[SKIP]");
  return `  ${badge}  ${name}${reason ? pc.dim(` — ${reason}`) : ""}`;
}

export function formatError(message: string, hints: string[] = []): string {
  const lines = [pc.red(`Error: ${message}`)];
  for (const hint of hints) {
    lines.push(pc.dim(`  → ${hint}`));
  }
  return lines.join("\n");
}

export function formatSuccess(message: string): string {
  return `${formatStatusBadge("VERIFIED")}  ${message}`;
}
