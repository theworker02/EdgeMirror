/**
 * Adaptive scheduler — priority queues + concurrency governed by resources/CU.
 *
 * Hot-path optimizations for large independent fan-outs (≥500 jobs):
 * - Batch-fill concurrency slots before awaiting completions
 * - Incremental DAG ready queue (no full-scan/sort each tick)
 * - In-place CU ledger charges
 * - performance.now() wall clock
 *
 * Scheduler kinds (either/or via options.scheduler):
 * - classic — fill all free slots aggressively
 * - double-trouble — dyadic / pair-wise: launch ready work in groups of two
 */

import { performance } from "node:perf_hooks";
import { canAfford, chargeCu, createCuBudget, estimateCu } from "./cu.js";
import { JobDag } from "./dag.js";
import { resolveGovernor } from "./governors.js";
import { captureResources } from "./resources.js";
import type {
  GovernorMode,
  JobSpec,
  JobState,
  ScheduleResult,
  SchedulerKind,
  SuperchargeOptions,
} from "./types.js";

export type JobExecutor = (job: JobState) => Promise<{
  cu?: number;
  result?: unknown;
  cacheHit?: boolean;
}>;

export interface RunSchedulerInput {
  jobs: JobSpec[];
  execute: JobExecutor;
  options?: SuperchargeOptions;
  /** Injected resource hints for adaptive concurrency */
  remoteLatencyMs?: number;
  rateLimitRemaining?: number;
}

/**
 * How many ready jobs to pull this tick.
 * Double Trouble prefers even batch sizes (pairs); singleton only when draining.
 */
export function planTakeCount(input: {
  scheduler: SchedulerKind;
  freeSlots: number;
  running: number;
}): { take: number; asPairs: boolean; allowSingleton: boolean } {
  const { scheduler, freeSlots, running } = input;
  if (freeSlots <= 0) {
    return { take: 0, asPairs: false, allowSingleton: false };
  }
  if (scheduler !== "double-trouble") {
    return { take: freeSlots, asPairs: false, allowSingleton: true };
  }
  // Pair lanes: only fill even slots while other work may still arrive.
  const even = freeSlots - (freeSlots % 2);
  if (even >= 2) {
    return { take: even, asPairs: true, allowSingleton: false };
  }
  // No full pair lane free — allow singleton only when nothing is running
  // (odd tail / progress under concurrency 1).
  if (running === 0) {
    return { take: 1, asPairs: false, allowSingleton: true };
  }
  return { take: 0, asPairs: true, allowSingleton: false };
}

export async function runScheduler(
  input: RunSchedulerInput,
): Promise<ScheduleResult> {
  const mode: GovernorMode = input.options?.mode ?? "BALANCED";
  const scheduler: SchedulerKind = input.options?.scheduler ?? "classic";
  const governor = resolveGovernor(mode, {
    maxConcurrency: input.options?.maxConcurrency,
    maxCu: input.options?.maxCu,
  });

  const resources = captureResources({
    mode,
    remoteLatencyMs: input.remoteLatencyMs,
    rateLimitRemaining: input.rateLimitRemaining,
    queueDepth: input.jobs.length,
  });

  // Explicit maxConcurrency override wins; otherwise min(governor, adaptive).
  let concurrency = input.options?.maxConcurrency
    ? Math.min(governor.maxConcurrency, input.options.maxConcurrency)
    : Math.min(governor.maxConcurrency, resources.recommendedConcurrency);

  // Double Trouble keeps an even lane count (pair slots) when concurrency > 1.
  if (scheduler === "double-trouble" && concurrency > 1) {
    concurrency = concurrency - (concurrency % 2);
  }

  const dag = new JobDag();
  dag.addMany(input.jobs);
  const validation = dag.validate();
  if (!validation.ok) {
    throw new Error(`Invalid job DAG: ${validation.errors.join("; ")}`);
  }

  const cu = createCuBudget(governor.maxCu);
  let cacheHits = 0;
  const wallStart = performance.now();
  let cancelledRemaining = false;
  let pairWaves = 0;
  let singletonTails = 0;

  const running = new Map<string, Promise<void>>();

  const cancelAllPending = (reason: string): void => {
    cancelledRemaining = true;
    for (const j of dag.all()) {
      if (j.status === "pending" || j.status === "ready") {
        dag.setStatus(j.id, "cancelled", { error: reason });
      }
    }
  };

  const startJob = (job: JobState): void => {
    const reserved = job.estimatedCu || estimateCu(job.kind);
    if (!canAfford(cu, reserved)) {
      return;
    }
    chargeCu(cu, {
      jobId: job.id,
      kind: job.kind,
      cu: reserved,
      note: "reserved",
    });
    dag.setStatus(job.id, "running", { startedAt: Date.now() });
    const task = (async () => {
      try {
        const out = await input.execute(job);
        const actual = out.cu ?? reserved;
        if (actual > reserved) {
          const extra = actual - reserved;
          if (canAfford(cu, extra)) {
            chargeCu(cu, {
              jobId: job.id,
              kind: job.kind,
              cu: extra,
              note: "actual-above-estimate",
            });
          } else {
            dag.setStatus(job.id, "failed", {
              finishedAt: Date.now(),
              actualCu: actual,
              error: "CU budget exceeded during job",
              cacheHit: out.cacheHit,
              result: out.result,
            });
            dag.failDependents(job.id);
            return;
          }
        }
        if (out.cacheHit) cacheHits += 1;
        dag.setStatus(job.id, "succeeded", {
          finishedAt: Date.now(),
          actualCu: actual,
          cacheHit: out.cacheHit,
          result: out.result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        dag.setStatus(job.id, "failed", {
          finishedAt: Date.now(),
          error: message,
        });
        dag.failDependents(job.id);
      } finally {
        running.delete(job.id);
      }
    })();
    running.set(job.id, task);
  };

  const startBatch = (batch: JobState[], asPairs: boolean): number => {
    let started = 0;
    const deferred: JobState[] = [];

    // Double Trouble: if we pulled an odd count while preferring pairs, park the last.
    let work = batch;
    if (asPairs && batch.length % 2 === 1) {
      const singleton = batch[batch.length - 1]!;
      work = batch.slice(0, -1);
      deferred.push(singleton);
    }

    for (const next of work) {
      if (running.size >= concurrency) {
        deferred.push(next);
        continue;
      }
      const cost = next.estimatedCu || estimateCu(next.kind);
      if (!canAfford(cu, cost)) {
        deferred.push(next);
        continue;
      }
      startJob(next);
      started += 1;
    }

    if (asPairs && started >= 2) {
      pairWaves += Math.floor(started / 2);
    }

    for (const j of deferred) dag.returnReady(j);
    return started;
  };

  const pump = async (): Promise<void> => {
    while (dag.hasPending()) {
      if (performance.now() - wallStart > governor.maxWallMs) {
        cancelAllPending("Cancelled: governor maxWallMs exceeded");
        break;
      }

      const slots = concurrency - running.size;
      if (slots <= 0) {
        await Promise.race(running.values());
        continue;
      }

      const plan = planTakeCount({
        scheduler,
        freeSlots: slots,
        running: running.size,
      });

      if (plan.take === 0) {
        if (running.size === 0) {
          cancelAllPending(
            "Cancelled: unmet dependencies or empty ready queue",
          );
          break;
        }
        await Promise.race(running.values());
        continue;
      }

      const batch = dag.takeReady(plan.take);
      if (batch.length === 0) {
        if (running.size === 0) {
          cancelAllPending(
            "Cancelled: unmet dependencies or empty ready queue",
          );
          break;
        }
        await Promise.race(running.values());
        continue;
      }

      // Double Trouble: lone ready job with nothing running → drain singleton
      // tail (odd leftover). Do this before pair batching so startBatch cannot
      // park-and-cancel the final job as "CU exhausted".
      if (
        scheduler === "double-trouble" &&
        batch.length === 1 &&
        running.size === 0
      ) {
        const lone = batch[0]!;
        const cost = lone.estimatedCu || estimateCu(lone.kind);
        if (canAfford(cu, cost) && concurrency >= 1) {
          startJob(lone);
          singletonTails += 1;
          continue;
        }
        dag.returnReady(lone);
        cancelAllPending("Cancelled: CU budget exhausted");
        break;
      }

      // Double Trouble with a lone ready job while others are running: wait for
      // a partner lane (or completion) instead of breaking the pair invariant.
      if (
        scheduler === "double-trouble" &&
        plan.asPairs &&
        batch.length === 1 &&
        running.size > 0
      ) {
        dag.returnReady(batch[0]!);
        await Promise.race(running.values());
        continue;
      }

      const started = startBatch(batch, plan.asPairs);

      if (started === 0) {
        // CU may be exhausted for remaining ready work.
        const peek = dag.takeReady(1);
        if (peek.length > 0) {
          dag.returnReady(peek[0]!);
          if (running.size === 0) {
            cancelAllPending("Cancelled: CU budget exhausted");
            break;
          }
        } else if (running.size === 0) {
          cancelAllPending(
            "Cancelled: unmet dependencies or empty ready queue",
          );
          break;
        }
        await Promise.race(running.values());
      }
    }

    await Promise.all(running.values());
  };

  await pump();

  return {
    jobs: dag.all(),
    cu,
    resources,
    governor: { ...governor, maxConcurrency: concurrency },
    wallMs: Math.max(1, Math.round(performance.now() - wallStart)),
    cacheHits,
    cancelledRemaining,
    scheduler,
    pairWaves,
    singletonTails,
  };
}
