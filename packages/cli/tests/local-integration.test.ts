import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { runParitySuite } from "../src/orchestrator/index.js";

function fixtureRoot(): string {
  const candidates = [
    join(process.cwd(), "fixtures", "basic-worker"),
    join(process.cwd(), "..", "..", "fixtures", "basic-worker"),
  ];
  const found = candidates.find((p) => existsSync(join(p, "wrangler.jsonc")));
  if (!found) throw new Error("basic-worker fixture not found");
  return found;
}

describe("local integration (wrangler)", () => {
  it("runs local-only parity against basic-worker fixture", async () => {
    const root = fixtureRoot();
    const result = await runParitySuite({
      cwd: root,
      localOnly: true,
      skipRemote: true,
      filter: "http-get-root",
      quiet: true,
      formats: ["json"],
    });
    expect(result.report.results.length).toBeGreaterThan(0);
    const localOk = result.report.checks?.some(
      (c) => c.id === "local-runtime" && c.status === "passed",
    );
    expect(localOk).toBe(true);
    // Remote skipped — classifications should be INSUFFICIENT or similar, not fake MATCH
    for (const r of result.report.results) {
      expect(r.classification).not.toBe("MATCH");
    }
  }, 120_000);
});
