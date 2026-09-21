import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { receiptToEmf } from "./index.js";
import {
  findReceipt,
  latestVerifyStatus,
  listFindingIds,
} from "../findings/index.js";
import type { EvidenceReceipt } from "../provenance/index.js";

describe("EMF/1", () => {
  it("serializes a receipt into EMF/1", () => {
    const receipt: EvidenceReceipt = {
      schemaVersion: "1.0",
      receiptId: "abc",
      findingId: "EM-001",
      createdAt: "2026-09-21T00:00:00.000Z",
      edgemirrorVersion: "1.4.0",
      classification: "MATCH",
      testId: "http-get-root",
      localTraceHash: "l".repeat(64),
      remoteTraceHash: "r".repeat(64),
      resultHash: "x".repeat(64),
      artifactPaths: [],
      notes: ["unit"],
    };
    const emf = receiptToEmf(receipt);
    expect(emf.schema).toBe("EMF/1");
    expect(emf.schemaVersion).toBe("1.0");
    expect(emf.findingId).toBe("EM-001");
    expect(emf.reproduce.commands.length).toBeGreaterThan(0);
  });
});

describe("findings helpers", () => {
  it("lists and loads receipts from .edgemirror", () => {
    const root = mkdtempSync(join(tmpdir(), "em-findings-"));
    try {
      const receipts = join(root, ".edgemirror", "receipts");
      mkdirSync(receipts, { recursive: true });
      const receipt: EvidenceReceipt = {
        schemaVersion: "1.0",
        receiptId: "abc",
        findingId: "EM-007",
        createdAt: "2026-09-21T00:00:00.000Z",
        edgemirrorVersion: "1.4.0",
        classification: "RUNTIME_DIVERGENCE",
        testId: "http-get-root",
        localTraceHash: "l".repeat(64),
        remoteTraceHash: "r".repeat(64),
        resultHash: "x".repeat(64),
        artifactPaths: [],
        notes: [],
      };
      writeFileSync(join(receipts, "EM-007.json"), JSON.stringify(receipt));
      expect(listFindingIds(root)).toEqual(["EM-007"]);
      expect(findReceipt(root, "EM-007")?.receipt.findingId).toBe("EM-007");
      const status = latestVerifyStatus(root);
      expect(status.findingCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
