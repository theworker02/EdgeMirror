/**
 * Evidence receipts — hashed provenance for parity findings.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExecutionTrace, ParityResult } from "../trace/schema.js";
import { EDGEMIRROR_VERSION } from "../version.js";

export interface EvidenceReceipt {
  schemaVersion: "1.0";
  receiptId: string;
  findingId: string;
  createdAt: string;
  edgemirrorVersion: string;
  classification: ParityResult["classification"];
  testId: string;
  localTraceHash: string;
  remoteTraceHash: string;
  resultHash: string;
  artifactPaths: string[];
  notes: string[];
}

export function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(typeof payload === "string" ? payload : JSON.stringify(payload))
    .digest("hex");
}

export function createReceipt(input: {
  findingId: string;
  result: ParityResult;
  localTrace: ExecutionTrace;
  remoteTrace: ExecutionTrace;
  artifactPaths?: string[];
  notes?: string[];
}): EvidenceReceipt {
  return {
    schemaVersion: "1.0",
    receiptId: hashPayload({
      findingId: input.findingId,
      at: Date.now(),
      testId: input.result.testId,
    }).slice(0, 32),
    findingId: input.findingId,
    createdAt: new Date().toISOString(),
    edgemirrorVersion: EDGEMIRROR_VERSION,
    classification: input.result.classification,
    testId: input.result.testId,
    localTraceHash: hashPayload(input.localTrace),
    remoteTraceHash: hashPayload(input.remoteTrace),
    resultHash: hashPayload(input.result),
    artifactPaths: input.artifactPaths ?? [],
    notes: input.notes ?? [],
  };
}

export function writeReceipt(
  receiptsDir: string,
  receipt: EvidenceReceipt,
): string {
  mkdirSync(receiptsDir, { recursive: true });
  const path = join(receiptsDir, `${receipt.findingId}.json`);
  writeFileSync(path, JSON.stringify(receipt, null, 2), "utf8");
  return path;
}

export function writeTrace(
  tracesDir: string,
  trace: ExecutionTrace,
): string {
  mkdirSync(tracesDir, { recursive: true });
  const path = join(tracesDir, `${trace.traceId}.json`);
  writeFileSync(path, JSON.stringify(trace, null, 2), "utf8");
  return path;
}

export function readReceipt(
  receiptsDir: string,
  findingId: string,
): EvidenceReceipt | undefined {
  const path = join(receiptsDir, `${findingId}.json`);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as EvidenceReceipt;
}

let findingCounter = 0;

export function nextFindingId(prefix = "EM"): string {
  findingCounter += 1;
  const n = String(findingCounter).padStart(3, "0");
  return `${prefix}-${n}`;
}

export function resetFindingCounter(start = 0): void {
  findingCounter = start;
}
