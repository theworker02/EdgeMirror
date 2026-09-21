import type { Command } from "commander";
import { resolveProjectRoot } from "../../config/index.js";
import { latestVerifyStatus, listFindingIds } from "../../findings/index.js";
import { EDGEMIRROR_VERSION } from "../../version.js";

const COLORS: Record<string, string> = {
  VERIFIED: "#0E7A3D",
  DIVERGENT: "#B42318",
  UNKNOWN: "#667085",
  BLOCKED: "#B54708",
  FAILED: "#B42318",
  DEMO: "#6941C6",
  RUNNING: "#175CD3",
  STALE: "#667085",
};

function svgBadge(label: string, status: string): string {
  const color = COLORS[status] ?? COLORS.UNKNOWN!;
  const left = label;
  const right = status;
  const leftW = 78;
  const rightW = Math.max(64, right.length * 8 + 16);
  const w = leftW + rightW;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${left}: ${right}">
  <title>${left}: ${right}</title>
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
  <rect width="${leftW}" height="20" fill="#24292F"/>
  <rect x="${leftW}" width="${rightW}" height="20" fill="${color}"/>
  <rect width="${w}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${leftW / 2}" y="14">${left}</text>
    <text x="${leftW + rightW / 2}" y="14">${right}</text>
  </g>
</svg>
`;
}

export function registerBadgeCommand(program: Command): void {
  program
    .command("badge")
    .description(
      "Emit markdown/SVG badge from real local verify artifacts (UNKNOWN if none)",
    )
    .option("--format <fmt>", "markdown|svg|json", "markdown")
    .option("--label <text>", "Badge left label", "EdgeMirror")
    .action((opts: { format?: string; label?: string }) => {
      const root = resolveProjectRoot();
      const snap = latestVerifyStatus(root);
      const findings = listFindingIds(root);
      const status = snap.status;
      const fmt = (opts.format ?? "markdown").toLowerCase();

      if (fmt === "json") {
        console.log(
          JSON.stringify(
            {
              schemaVersion: "1.0",
              kind: "edgemirror-badge",
              edgemirrorVersion: EDGEMIRROR_VERSION,
              label: opts.label ?? "EdgeMirror",
              status,
              source: snap.source,
              findingCount: findings.length,
              findingIds: findings,
              honesty:
                "Status is derived from local .edgemirror artifacts only. UNKNOWN means no usable verify report yet — not a MATCH.",
            },
            null,
            2,
          ),
        );
        return;
      }

      if (fmt === "svg") {
        process.stdout.write(svgBadge(opts.label ?? "EdgeMirror", status));
        return;
      }

      // markdown
      const colorHint =
        status === "VERIFIED"
          ? "brightgreen"
          : status === "DIVERGENT" || status === "FAILED"
            ? "red"
            : status === "DEMO"
              ? "purple"
              : "lightgrey";
      console.log(
        `![${opts.label ?? "EdgeMirror"}: ${status}](https://img.shields.io/badge/${encodeURIComponent(opts.label ?? "EdgeMirror")}-${encodeURIComponent(status)}-${colorHint})`,
      );
      console.log("");
      console.log(
        `Status **${status}** from ${snap.source ?? "no local artifacts"} · findings: ${findings.length ? findings.join(", ") : "(none)"}`,
      );
      console.log(
        "Honesty: UNKNOWN ≠ MATCH. Run `edgemirror verify` (with credentials for remote) before citing.",
      );
    });
}
