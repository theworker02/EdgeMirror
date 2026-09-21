/**
 * Reproducible micro-benchmarks: sequential vs Supercharger scheduler.
 * Reports measured numbers only — never invents speedups.
 *
 * Default workload: 500 independent short sleeps — large enough to show
 * real scheduler fan-out without claiming wrangler/verify speedups.
 */

import { performance } from "node:perf_hooks";
import { runScheduler } from "./scheduler.js";
import type { JobSpec, GovernorMode, SchedulerKind } from "./types.js";

export interface MicrobenchResult {
  schemaVersion: "1.0";
  kind: "supercharger-microbench";
  measuredAt: string;
  workload: {
    jobs: number;
    sleepMs: number;
    mode: GovernorMode;
    scheduler: SchedulerKind;
    maxConcurrency?: number;
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
    jobsCompleted: number;
    scheduler: SchedulerKind;
    pairWaves: number;
    singletonTails: number;
  };
  ratio: {
    /** standard.wallMs / supercharger.wallMs — measured, may be <1 */
    wallSpeedupMeasured: number;
  };
  methodology: string;
  disclaimer: string;
}

/** Default synthetic fan-out — demonstrates ≥500-job scheduler capacity. */
export const MICROBENCH_DEFAULT_JOBS = 500;
export const MICROBENCH_DEFAULT_SLEEP_MS = 8;

export async function runMicrobench(opts?: {
  jobs?: number;
  sleepMs?: number;
  mode?: GovernorMode;
  scheduler?: SchedulerKind;
  maxConcurrency?: number;
}): Promise<MicrobenchResult> {
  const n = Math.max(1, opts?.jobs ?? MICROBENCH_DEFAULT_JOBS);
  const sleepMs = Math.max(1, opts?.sleepMs ?? MICROBENCH_DEFAULT_SLEEP_MS);
  const mode = opts?.mode ?? "MAX";
  const scheduler = opts?.scheduler ?? "classic";
  // Prefer explicit ceiling so adaptive recommendConcurrency cannot under-fan-out.
  const maxConcurrency =
    opts?.maxConcurrency ?? (mode === "MAX" ? 128 : undefined);

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
    options: {
      enabled: true,
      mode,
      scheduler,
      maxCu: Math.max(10_000, n),
      maxConcurrency,
    },
    execute: async () => {
      await work();
      return { cu: 1 };
    },
  });

  const completed = schedule.jobs.filter((j) => j.status === "succeeded").length;
  const seqJobsPerSec = n / (sequentialMs / 1000);
  const scJobsPerSec = completed / (schedule.wallMs / 1000);
  const ratio = sequentialMs / Math.max(1, schedule.wallMs);

  return {
    schemaVersion: "1.0",
    kind: "supercharger-microbench",
    measuredAt: new Date().toISOString(),
    workload: {
      jobs: n,
      sleepMs,
      mode,
      scheduler,
      ...(maxConcurrency !== undefined ? { maxConcurrency } : {}),
    },
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
      jobsCompleted: completed,
      scheduler: schedule.scheduler,
      pairWaves: schedule.pairWaves,
      singletonTails: schedule.singletonTails,
    },
    ratio: {
      wallSpeedupMeasured: Number(ratio.toFixed(3)),
    },
    methodology:
      `Sequential baseline awaits ${n} independent setTimeout(${sleepMs}ms) jobs one-by-one. ` +
      `Supercharger (${scheduler}) schedules the same jobs under governor ${mode}` +
      (maxConcurrency ? ` with maxConcurrency=${maxConcurrency}` : "") +
      `. Wall times from performance.now(). ` +
      `I/O-bound synthetic only — not wrangler/workerd verify.`,
    disclaimer:
      "Measured synthetic I/O-bound jobs only. Not a claim about wrangler/parity verify speedups. Re-run on your machine. CU is accounting only — not cryptocurrency.",
  };
}
