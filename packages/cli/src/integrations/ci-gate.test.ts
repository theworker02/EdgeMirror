import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLOUDFLARE_GATE_WORKFLOW_YAML,
  GITHUB_WORKFLOW_YAML,
} from "./github-workflow.js";
import { createSupportEscalationBundle } from "../support/escalation-bundle.js";

describe("CI / Cloudflare gate scaffolds", () => {
  it("exports a reusable-workflow-based Cloudflare gate", () => {
    expect(CLOUDFLARE_GATE_WORKFLOW_YAML).toMatch(/reusable-edgemirror-verify\.yml/);
    expect(CLOUDFLARE_GATE_WORKFLOW_YAML).toMatch(/Verify before deploy/);
    expect(CLOUDFLARE_GATE_WORKFLOW_YAML).toMatch(/not affiliated with Cloudflare/);
    expect(GITHUB_WORKFLOW_YAML).toMatch(/integrations\/github-actions\/verify/);
  });
});

describe("support escalation bundle", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "edgemirror-escalate-"));
    writeFileSync(
      join(root, "wrangler.toml"),
      'name = "fixture"\nmain = "src/index.ts"\ncompatibility_date = "2024-11-11"\n',
      "utf8",
    );
    const receipts = join(root, ".edgemirror", "receipts");
    mkdirSync(receipts, { recursive: true });
    writeFileSync(
      join(receipts, "EM-001.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        findingId: "EM-001",
        classification: "RUNTIME_DIVERGENCE",
        notes: ["fixture"],
      }),
      "utf8",
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes ticket guide, support-report, and EM receipts", () => {
    const { bundleDir, manifest } = createSupportEscalationBundle({
      projectRoot: root,
      doctorFingerprint: { ok: true },
    });

    expect(existsSync(join(bundleDir, "CLOUDFLARE_TICKET.md"))).toBe(true);
    expect(existsSync(join(bundleDir, "support-report.json"))).toBe(true);
    expect(existsSync(join(bundleDir, "bindings-matrix.txt"))).toBe(true);
    expect(existsSync(join(bundleDir, "receipts", "EM-001.json"))).toBe(true);
    expect(existsSync(join(bundleDir, "manifest.json"))).toBe(true);
    expect(manifest.kind).toBe("cloudflare-support-escalation");
    expect(manifest.findingIds).toContain("EM-001");
    expect(manifest.authenticity.join(" ")).toMatch(/REMOTE_NOT_CONFIGURED/);

    const report = JSON.parse(
      readFileSync(join(bundleDir, "support-report.json"), "utf8"),
    ) as { honesty: string[] };
    expect(report.honesty.join(" ")).toMatch(/not affiliated/i);
  });
});
