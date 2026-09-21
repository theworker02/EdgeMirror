/**
 * Finding discovery across .edgemirror artifacts (receipts / runs).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { artifactsDir } from "../config/index.js";
import type { EvidenceReceipt } from "../provenance/index.js";

export function listRunDirs(rootArtifacts: string): string[] {
  const runs = join(rootArtifacts, "runs");
  if (!existsSync(runs)) return [];
  return readdirSync(runs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(runs, d.name));
}

export function listFindingIds(projectRoot: string): string[] {
  const rootArtifacts = artifactsDir(projectRoot);
  const ids = new Set<string>();
  const receiptDirs = [
    join(rootArtifacts, "receipts"),
    ...listRunDirs(rootArtifacts).map((r) => join(r, "receipts")),
  ];
  for (const dir of receiptDirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      const m = /^(EM-\d+)\.json$/i.exec(name);
      if (m) ids.add(m[1]!.toUpperCase());
    }
  }
  return [...ids].sort();
}

export function findReceipt(
  projectRoot: string,
  findingId: string,
): { receipt: EvidenceReceipt; path: string } | undefined {
  const id = findingId.toUpperCase();
  const rootArtifacts = artifactsDir(projectRoot);
  const candidates = [
    join(rootArtifacts, "receipts", `${id}.json`),
    ...listRunDirs(rootArtifacts).map((r) => join(r, "receipts", `${id}.json`)),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const receipt = JSON.parse(readFileSync(path, "utf8")) as EvidenceReceipt;
    return { receipt, path };
  }
  return undefined;
}

/** Latest verify report status if present; else UNKNOWN. */
export function latestVerifyStatus(projectRoot: string): {
  status: string;
  source: string | null;
  findingCount: number;
} {
  const rootArtifacts = artifactsDir(projectRoot);
  const runs = listRunDirs(rootArtifacts).sort().reverse();
  const reportNames = ["report.json", "summary.json", "parity-report.json"];
  for (const run of runs) {
    for (const name of reportNames) {
      const p = join(run, name);
      if (!existsSync(p)) continue;
      try {
        const raw = JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
        const status =
          (typeof raw.status === "string" && raw.status) ||
          (typeof raw.overall === "string" && raw.overall) ||
          (typeof raw.classification === "string" && raw.classification) ||
          "UNKNOWN";
        return {
          status: String(status).toUpperCase(),
          source: p,
          findingCount: listFindingIds(projectRoot).length,
        };
      } catch {
        /* try next */
      }
    }
    // Infer from receipts in this run
    const receipts = join(run, "receipts");
    if (existsSync(receipts)) {
      const files = readdirSync(receipts).filter((f) => /^EM-\d+\.json$/i.test(f));
      if (files.length > 0) {
        let divergent = false;
        let verified = 0;
        for (const f of files) {
          try {
            const r = JSON.parse(
              readFileSync(join(receipts, f), "utf8"),
            ) as EvidenceReceipt;
            if (
              r.classification === "RUNTIME_DIVERGENCE" ||
              r.classification === "POSSIBLE_RUNTIME_DIVERGENCE"
            ) {
              divergent = true;
            } else if (r.classification === "MATCH") {
              verified += 1;
            }
          } catch {
            /* skip */
          }
        }
        if (divergent) {
          return {
            status: "DIVERGENT",
            source: receipts,
            findingCount: files.length,
          };
        }
        if (verified > 0) {
          return {
            status: "VERIFIED",
            source: receipts,
            findingCount: files.length,
          };
        }
      }
    }
  }
  const ids = listFindingIds(projectRoot);
  if (ids.length === 0) {
    return { status: "UNKNOWN", source: null, findingCount: 0 };
  }
  return { status: "UNKNOWN", source: rootArtifacts, findingCount: ids.length };
}
