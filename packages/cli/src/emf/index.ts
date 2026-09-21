/**
 * EMF/1 — EdgeMirror Finding format (public, versioned JSON).
 * Serializes EM-### evidence receipts into a portable finding document.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EDGEMIRROR_VERSION } from "../version.js";
import type { EvidenceReceipt } from "../provenance/index.js";
import { findReceipt } from "../findings/index.js";

export const EMF_SCHEMA_VERSION = "1.0" as const;

export interface EmfFinding {
  schema: "EMF/1";
  schemaVersion: typeof EMF_SCHEMA_VERSION;
  findingId: string;
  createdAt: string;
  edgemirrorVersion: string;
  classification: string;
  testId: string;
  hashes: {
    localTrace: string;
    remoteTrace: string;
    result: string;
    receiptId: string;
  };
  artifactPaths: string[];
  notes: string[];
  reproduce: {
    commands: string[];
    honesty: string[];
  };
  sourceReceiptPath?: string;
}

export function receiptToEmf(
  receipt: EvidenceReceipt,
  sourcePath?: string,
): EmfFinding {
  return {
    schema: "EMF/1",
    schemaVersion: EMF_SCHEMA_VERSION,
    findingId: receipt.findingId,
    createdAt: receipt.createdAt,
    edgemirrorVersion: receipt.edgemirrorVersion || EDGEMIRROR_VERSION,
    classification: String(receipt.classification),
    testId: receipt.testId,
    hashes: {
      localTrace: receipt.localTraceHash,
      remoteTrace: receipt.remoteTraceHash,
      result: receipt.resultHash,
      receiptId: receipt.receiptId,
    },
    artifactPaths: receipt.artifactPaths ?? [],
    notes: receipt.notes ?? [],
    reproduce: {
      commands: [
        `edgemirror reproduce ${receipt.findingId}`,
        `edgemirror bundle ${receipt.findingId}`,
        "edgemirror verify --local",
        "edgemirror verify  # requires Cloudflare credentials for remote half",
      ],
      honesty: [
        "Do not cite DEMO / pitch-demo findings as production bugs.",
        "REMOTE_NOT_CONFIGURED is not a MATCH.",
        "Re-run verify on the same Worker + compatibility date before escalating.",
      ],
    },
    ...(sourcePath ? { sourceReceiptPath: sourcePath } : {}),
  };
}

export function exportEmfFinding(
  projectRoot: string,
  findingId: string,
  outDir?: string,
): { emf: EmfFinding; outPath: string } | { error: string } {
  const found = findReceipt(projectRoot, findingId);
  if (!found) {
    return {
      error: `No receipt for ${findingId}. Run edgemirror verify (or pitch-demo) first.`,
    };
  }
  const emf = receiptToEmf(found.receipt, found.path);
  const dir = outDir ?? join(projectRoot, ".edgemirror", "emf");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${emf.findingId}.emf.json`);
  writeFileSync(outPath, JSON.stringify(emf, null, 2), "utf8");
  return { emf, outPath };
}
