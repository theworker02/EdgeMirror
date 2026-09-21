import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  JobDag,
  buildParityDag,
  runScheduler,
  planTakeCount,
  createCuBudget,
  chargeCu,
  canAfford,
  resolveGovernor,
  recommendConcurrency,
  ContentAddressedCache,
  FORBIDDEN_EVIDENCE_KINDS,
  selectForMode,
  parallelMinimize,
  pruneCompatMatrix,
  buildSuperchargePlan,
  runMicrobench,
  evaluatePerfGates,
  startRunner,
  compareBudgets,
  optimizeForBudget,
  parseSchedulerKind,
} from "./index.js";
import { BUILTIN_CORPUS as CORPUS } from "../corpus/index.js";

describe("Supercharger DAG", () => {
  it("builds a valid parity DAG with time-to-confidence priorities", () => {
    const specs = buildParityDag({
      testIds: ["http-get-root", "http-post-echo", "fuzz-exploratory"],
      includeRemote: false,
      timeToConfidence: true,
    });
    const dag = new JobDag();
    dag.addMany(specs);
    const v = dag.validate();
    expect(v.ok).toBe(true);
    const root = specs.find((s) => s.id === "local:http-get-root");
    const fuzz = specs.find((s) => s.id === "local:fuzz-exploratory");
    expect(root?.priority).toBe(0);
    expect(fuzz?.priority).toBe(4);
  });
});

describe("CU accounting", () => {
  it("tracks budget without implying currency", () => {
    let budget = createCuBudget(10);
    expect(canAfford(budget, 5)).toBe(true);
    budget = chargeCu(budget, {
      jobId: "j1",
      kind: "execute_local",
      cu: 5,
      note: "accounting only",
    });
    expect(budget.used).toBe(5);
    expect(canAfford(budget, 6)).toBe(false);
  });
});

describe("Governors + adaptive concurrency", () => {
  it("ECO is serial; MAX defaults high concurrency", () => {
    expect(resolveGovernor("ECO").maxConcurrency).toBe(1);
    expect(resolveGovernor("MAX").maxConcurrency).toBe(128);
    const conc = recommendConcurrency({
      cpus: 8,
      freeMemMb: 8192,
      mode: "BALANCED",
    });
    expect(conc).toBeGreaterThanOrEqual(1);
    expect(conc).toBeLessThanOrEqual(8);
  });

  it("allows CU overrides above governor baseline (Supercharger II)", () => {
    const g = resolveGovernor("ECO", { maxCu: 50_000 });
    expect(g.maxCu).toBe(50_000);
  });

  it("backs off under rate-limit pressure", () => {
    const conc = recommendConcurrency({
      cpus: 16,
      freeMemMb: 32000,
      mode: "MAX",
      rateLimitRemaining: 2,
    });
    expect(conc).toBe(1);
  });

  it("MAX recommends aggressive fan-out on deep queues", () => {
    const conc = recommendConcurrency({
      cpus: 16,
      freeMemMb: 32000,
      mode: "MAX",
      queueDepth: 500,
    });
    expect(conc).toBeGreaterThanOrEqual(32);
  });
});

describe("Optimizer — CU budget selects different work", () => {
  const testIds = CORPUS.map((t) => t.id);

  it("higher CU selects more packages and deeper verification", () => {
    const { low, high, addedPackages, depthIncreased } = compareBudgets(
      5,
      500,
      { testIds, includeRemote: false },
    );
    expect(low.selected).toContain("required_parity");
    expect(high.selected.length).toBeGreaterThan(low.selected.length);
    expect(addedPackages.length).toBeGreaterThan(0);
    expect(depthIncreased || addedPackages.length > 0).toBe(true);
    expect(high.estimatedCu).toBeGreaterThan(low.estimatedCu);
  });

  it("CU 500 schedules at least 500 jobs when budget allows", () => {
    const high = optimizeForBudget({
      budgetCu: 500,
      testIds,
      includeRemote: false,
    });
    expect(high.jobs.length).toBeGreaterThanOrEqual(500);
    expect(high.estimatedCu).toBeLessThanOrEqual(500);
  });

  it("scarce CU defers research/fuzz packages", () => {
    const scarce = optimizeForBudget({
      budgetCu: 8,
      testIds,
      includeRemote: false,
    });
    expect(scarce.deferred).toEqual(
      expect.arrayContaining(["differential_fuzz", "research_swarm"]),
    );
  });
});

describe("Scheduler", () => {
  it("runs independent jobs concurrently and enforces CU budget", async () => {
    const specs = Array.from({ length: 6 }, (_, i) => ({
      id: `j${i}`,
      kind: "custom" as const,
      name: `J${i}`,
      priority: 2 as const,
      estimatedCu: 1,
      dependsOn: [] as string[],
    }));
    const seen: string[] = [];
    const result = await runScheduler({
      jobs: specs,
      options: { enabled: true, mode: "FAST", maxCu: 3, maxConcurrency: 4 },
      execute: async (job) => {
        seen.push(job.id);
        await new Promise((r) => setTimeout(r, 20));
        return { cu: 1 };
      },
    });
    expect(result.cu.used).toBeLessThanOrEqual(3);
    expect(result.cancelledRemaining || result.jobs.some((j) => j.status === "cancelled")).toBe(
      true,
    );
    expect(seen.length).toBeLessThanOrEqual(3);
  });

  it("schedules ≥500 independent jobs under MAX", async () => {
    const n = 500;
    const specs = Array.from({ length: n }, (_, i) => ({
      id: `bulk-${i}`,
      kind: "custom" as const,
      name: `B${i}`,
      priority: 2 as const,
      estimatedCu: 1,
      dependsOn: [] as string[],
    }));
    const result = await runScheduler({
      jobs: specs,
      options: {
        enabled: true,
        mode: "MAX",
        maxCu: n,
        maxConcurrency: 64,
      },
      execute: async () => {
        await new Promise((r) => setTimeout(r, 2));
        return { cu: 1 };
      },
    });
    const ok = result.jobs.filter((j) => j.status === "succeeded").length;
    expect(ok).toBe(n);
    expect(result.wallMs).toBeLessThan(n * 2); // must beat near-sequential
  });

  it("respects dependencies", async () => {
    const order: string[] = [];
    await runScheduler({
      jobs: [
        {
          id: "a",
          kind: "discover",
          name: "A",
          priority: 0,
          estimatedCu: 1,
          dependsOn: [],
        },
        {
          id: "b",
          kind: "prepare_local",
          name: "B",
          priority: 0,
          estimatedCu: 1,
          dependsOn: ["a"],
        },
      ],
      options: { enabled: true, mode: "ECO", maxCu: 100 },
      execute: async (job) => {
        order.push(job.id);
        return { cu: 1 };
      },
    });
    expect(order).toEqual(["a", "b"]);
  });
});

describe("Content-addressed cache", () => {
  it("stores safe artifacts and refuses evidence kinds", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-cache-"));
    try {
      const cache = new ContentAddressedCache(dir);
      const { key } = cache.putStable("plan", ["p1"], { jobs: 3 });
      const hit = cache.getByKey<{ jobs: number }>(key);
      expect(hit.hit).toBe(true);
      if (hit.hit) {
        expect(hit.value.jobs).toBe(3);
        expect(hit.meta.notRemoteEvidence).toBe(true);
      }
      expect(FORBIDDEN_EVIDENCE_KINDS.has("parity_result")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Selection", () => {
  it("fast mode selects P0/root subset", () => {
    const sel = selectForMode(CORPUS, "fast");
    expect(sel.selected.length).toBeGreaterThan(0);
    expect(sel.selected.length).toBeLessThanOrEqual(CORPUS.length);
    expect(sel.reason.toLowerCase()).toContain("fast");
  });

  it("full mode keeps all", () => {
    const sel = selectForMode(CORPUS, "full");
    expect(sel.selected.length).toBe(CORPUS.length);
    expect(sel.skipped.length).toBe(0);
  });
});

describe("Parallel minimizer", () => {
  it("reduces a synthetic failing set", async () => {
    const failing = new Set(["c", "g"]);
    const result = await parallelMinimize({
      candidates: ["a", "b", "c", "d", "e", "f", "g", "h"],
      keyOf: (x) => x,
      stillFails: (subset) => subset.some((x) => failing.has(x)),
      mode: "FAST",
    });
    expect(result.minimized.length).toBeLessThan(8);
    expect(result.minimized.some((x) => failing.has(x))).toBe(true);
    expect(result.note.toLowerCase()).toContain("measured");
  });
});

describe("Matrix prune", () => {
  it("drops invalid and duplicate cells", () => {
    const r = pruneCompatMatrix([
      { compatibilityDate: "2024-11-11", testId: "http-get-root" },
      { compatibilityDate: "2024-11-11", testId: "http-get-root" },
      { compatibilityDate: "not-a-date", testId: "http-get-root" },
      { compatibilityDate: "1999-01-01", testId: "http-get-root" },
    ]);
    expect(r.keep.length).toBe(1);
    expect(r.pruned.length).toBe(3);
  });
});

describe("Plan + microbench gates", () => {
  it("plan is labeled as estimates", () => {
    const plan = buildSuperchargePlan({
      testIds: CORPUS.map((t) => t.id),
      mode: "BALANCED",
    });
    expect(plan.disclaimer.toUpperCase()).toContain("ESTIMATE");
    expect(plan.totals.estimatedCu).toBeGreaterThan(0);
  });

  it("microbench reports measured ratio only and passes gates", async () => {
    const bench = await runMicrobench({ jobs: 12, sleepMs: 8, mode: "FAST" });
    expect(bench.disclaimer.toLowerCase()).toContain("measured");
    expect(bench.ratio.wallSpeedupMeasured).toBeGreaterThan(0);
    const gates = evaluatePerfGates(bench);
    expect(gates.passed).toBe(true);
  });
});

describe("Double Trouble scheduler", () => {
  it("parses classic and double-trouble aliases", () => {
    expect(parseSchedulerKind("classic")).toBe("classic");
    expect(parseSchedulerKind("default")).toBe("classic");
    expect(parseSchedulerKind("double-trouble")).toBe("double-trouble");
    expect(parseSchedulerKind("dt")).toBe("double-trouble");
    expect(parseSchedulerKind("pairs")).toBe("double-trouble");
    expect(() => parseSchedulerKind("nope")).toThrow(/Unknown scheduler/);
  });

  it("planTakeCount prefers even batches for double-trouble", () => {
    expect(
      planTakeCount({ scheduler: "classic", freeSlots: 5, running: 0 }),
    ).toEqual({ take: 5, asPairs: false, allowSingleton: true });
    expect(
      planTakeCount({
        scheduler: "double-trouble",
        freeSlots: 5,
        running: 2,
      }),
    ).toEqual({ take: 4, asPairs: true, allowSingleton: false });
    expect(
      planTakeCount({
        scheduler: "double-trouble",
        freeSlots: 1,
        running: 2,
      }),
    ).toEqual({ take: 0, asPairs: true, allowSingleton: false });
    expect(
      planTakeCount({
        scheduler: "double-trouble",
        freeSlots: 1,
        running: 0,
      }),
    ).toEqual({ take: 1, asPairs: false, allowSingleton: true });
  });

  it("runs independent jobs in pairs and records pairWaves", async () => {
    const n = 7; // odd → expect singleton tail
    const specs = Array.from({ length: n }, (_, i) => ({
      id: `dt-${i}`,
      kind: "custom" as const,
      name: `DT${i}`,
      priority: 2 as const,
      estimatedCu: 1,
      dependsOn: [] as string[],
    }));
    const result = await runScheduler({
      jobs: specs,
      options: {
        enabled: true,
        mode: "FAST",
        scheduler: "double-trouble",
        maxCu: n,
        maxConcurrency: 4,
      },
      execute: async () => {
        await new Promise((r) => setTimeout(r, 5));
        return { cu: 1 };
      },
    });
    expect(result.scheduler).toBe("double-trouble");
    expect(result.jobs.filter((j) => j.status === "succeeded").length).toBe(n);
    expect(result.pairWaves).toBeGreaterThanOrEqual(3);
    expect(result.singletonTails).toBeGreaterThanOrEqual(1);
    // Even concurrency under Double Trouble when >1
    expect(result.governor.maxConcurrency % 2).toBe(0);
  });

  it("microbench supports double-trouble scheduler", async () => {
    const bench = await runMicrobench({
      jobs: 16,
      sleepMs: 5,
      mode: "FAST",
      scheduler: "double-trouble",
      maxConcurrency: 8,
    });
    expect(bench.workload.scheduler).toBe("double-trouble");
    expect(bench.supercharger.scheduler).toBe("double-trouble");
    expect(bench.supercharger.pairWaves).toBeGreaterThan(0);
    expect(evaluatePerfGates(bench).passed).toBe(true);
  });
});

describe("Runner start hardening", () => {
  it("refuses to start without a strong token", async () => {
    delete process.env.EDGEMIRROR_RUNNER_TOKEN;
    delete process.env.EDGEMIRROR_RUNNER_AUTH;
    await expect(startRunner({ token: "short" })).rejects.toThrow(/refused/i);
  });

  it("starts on loopback with token and requires auth", async () => {
    const handle = await startRunner({
      token: "test-runner-token-32chars!!",
      host: "127.0.0.1",
      port: 0,
      mode: "ECO",
    });
    try {
      const denied = await fetch(`${handle.url}/health`);
      expect(denied.status).toBe(401);
      const ok = await fetch(`${handle.url}/health`, {
        headers: { Authorization: "Bearer test-runner-token-32chars!!" },
      });
      expect(ok.status).toBe(200);
      const body = (await ok.json()) as { ok: boolean };
      expect(body.ok).toBe(true);
    } finally {
      await handle.close();
    }
  });
});

describe("OSS verify independence", () => {
  it("builtin corpus remains available without enabling Supercharger", () => {
    expect(CORPUS.length).toBeGreaterThan(0);
  });
});
