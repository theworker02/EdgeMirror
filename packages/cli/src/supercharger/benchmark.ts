/**
 * Reproducible micro-benchmarks: sequential vs Supercharger scheduler.
 * Reports measured numbers only — never invents speedups.
 */

import { performance } from "node:perf_hooks";
import { runScheduler } from "./scheduler.js";
import type { JobSpec, GovernorMode } from "./types.js";

export interface MicrobenchResult {
  schemaVersion: "1.0";
  kind: "supercharger-microbench";
  measuredAt: string;
  workload: {
    jobs: number;
    sleepMs: number;
    mode: GovernorMode;
  };
  standard: {
    label: "sequential";
    wallMs: number;
    jobsPerSec: number;
  };
  supercharger: {
    label: "scheduler";
    wallMs: number;
    jobsPerSec: number;
    concurrency: number;
    cacheHits: number;
    cuUsed: number;
  };
  ratio: {
    /** standard.wallMs / supercharger.wallMs — measured, may be <1 */
    wallSpeedupMeasured: number;
  };
  disclaimer: string;
}

export async function runMicrobench(opts?: {
  jobs?: number;
  sleepMs?: number;
  mode?: GovernorMode;
}): Promise<MicrobenchResult> {
  const n = opts?.jobs ?? 24;
  const sleepMs = opts?.sleepMs ?? 15;
  const mode = opts?.mode ?? "FAST";

  const work = async () => {
    await new Promise((r) => setTimeout(r, sleepMs));
  };

  const t0 = performance.now();
  for (let i = 0; i < n; i++) await work();
  const sequentialMs = performance.now() - t0;

  const jobs: JobSpec[] = Array.from({ length: n }, (_, i) => ({
    id: `bench-${i}`,
    kind: "custom" as const,
    name: `Bench ${i}`,
    priority: 2 as const,
    estimatedCu: 1,
    dependsOn: [],
  }));

  const schedule = await runScheduler({
    jobs,
    options: { enabled: true, mode, maxCu: 10_000 },
    execute: async () => {
      await work();
      return { cu: 1 };
    },
  });

  const seqJobsPerSec = n / (sequentialMs / 1000);
  const scJobsPerSec = n / (schedule.wallMs / 1000);
  const ratio = sequentialMs / Math.max(1, schedule.wallMs);

  return {
    schemaVersion: "1.0",
    kind: "supercharger-microbench",
    measuredAt: new Date().toISOString(),
    workload: { jobs: n, sleepMs, mode },
    standard: {
      label: "sequential",
      wallMs: Math.round(sequentialMs),
      jobsPerSec: Number(seqJobsPerSec.toFixed(2)),
    },
    supercharger: {
      label: "scheduler",
      wallMs: schedule.wallMs,
      jobsPerSec: Number(scJobsPerSec.toFixed(2)),
      concurrency: schedule.governor.maxConcurrency,
      cacheHits: schedule.cacheHits,
      cuUsed: schedule.cu.used,
    },
    ratio: {
      wallSpeedupMeasured: Number(ratio.toFixed(3)),
    },
    disclaimer:
      "Measured synthetic I/O-bound jobs only. Not a claim about wrangler/parity verify speedups. Re-run on your machine.",
  };
}
