import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import { runParitySuite } from "../src/orchestrator/index.js";
import { LocalExecutionTarget } from "../src/execution/local.js";
import {
  createFingerprint,
  emptyBindingSummary,
} from "../src/trace/factory.js";
import { CLOUDFLARE_BINDING_SUPPORT } from "../src/adapters/cloudflare/bindings.js";

function fixtureRoot(): string {
  const candidates = [
    join(process.cwd(), "fixtures", "bindings-http"),
    join(process.cwd(), "..", "..", "fixtures", "bindings-http"),
  ];
  const found = candidates.find((p) => existsSync(join(p, "wrangler.jsonc")));
  if (!found) throw new Error("bindings-http fixture not found");
  return found;
}

describe("bindings-http local (wrangler)", () => {
  it("matrix declares every Cloudflare surface STABLE", () => {
    expect(CLOUDFLARE_BINDING_SUPPORT.length).toBeGreaterThanOrEqual(14);
    for (const b of CLOUDFLARE_BINDING_SUPPORT) {
      expect(b.parity).toBe("STABLE");
      expect(b.local).toBe("STABLE");
    }
  });

  it("exercises STABLE binding probes over HTTP against local workerd", async () => {
    const root = fixtureRoot();
    const ownershipDir = join(root, ".edgemirror", "ownership-test");
    mkdirSync(ownershipDir, { recursive: true });

    const fp = createFingerprint({
      projectRoot: root,
      workerName: "edgemirror-fixture-bindings",
      entryPoint: "src/index.ts",
      compatibilityDate: "2025-04-01",
      compatibilityFlags: [],
      bindings: emptyBindingSummary(),
    });

    const local = new LocalExecutionTarget({
      projectRoot: root,
      wranglerConfigPath: join(root, "wrangler.jsonc"),
      configurationFingerprint: fp,
      ownershipDir,
    });

    try {
      await local.prepare();
      const cases = [
        { path: "/bindings/vars", needle: "edgemirror-vars-ok" },
        { path: "/bindings/kv", needle: "edgemirror-kv-ok" },
        { path: "/bindings/d1", needle: "edgemirror-d1-ok" },
        { path: "/bindings/r2", needle: "edgemirror-r2-ok" },
        { path: "/bindings/do", needle: "edgemirror-do-ok" },
        { path: "/bindings/queues", needle: "edgemirror-queues-ok" },
        { path: "/bindings/service", needle: "edgemirror-service-ok" },
        { path: "/bindings/workflows", needle: "edgemirror-workflows-ok" },
        { path: "/bindings/hyperdrive", needle: "edgemirror-hyperdrive-ok" },
        { path: "/bindings/vectorize", needle: "edgemirror-vectorize-ok" },
        { path: "/bindings/ai", needle: "edgemirror-ai-ok" },
        { path: "/bindings/ws", needle: "edgemirror-ws-ok" },
        { path: "/bindings/cron", needle: "edgemirror-cron-ok" },
      ];
      for (const c of cases) {
        const trace = await local.execute({
          id: `direct-${c.path}`,
          name: c.path,
          feature: "bindings",
          request: { method: "GET", path: c.path },
        });
        expect(trace.status).toBe("ok");
        const body = trace.observations.http.body;
        expect(body.availability).toBe("captured");
        if (body.availability === "captured") {
          expect(String(body.value)).toContain(c.needle);
        }
      }
    } finally {
      await local.cleanup().catch(() => undefined);
    }
  }, 240_000);

  it("runs local verify filter=bindings without inventing remote MATCH", async () => {
    const root = fixtureRoot();
    const result = await runParitySuite({
      cwd: root,
      localOnly: true,
      skipRemote: true,
      filter: "bindings",
      quiet: true,
      formats: ["json"],
    });
    expect(result.report.results.length).toBeGreaterThanOrEqual(10);
    for (const r of result.report.results) {
      expect(r.classification).not.toBe("MATCH");
    }
  }, 240_000);
});
