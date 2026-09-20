/**
 * Adaptive scheduler — priority queues + concurrency governed by resources/CU.
 */

import { canAfford, chargeCu, createCuBudget, estimateCu } from "./cu.js";
import { JobDag } from "./dag.js";
import { resolveGovernor } from "./governors.js";
import { captureResources } from "./resources.js";
import type {
  GovernorMode,
  JobSpec,
  JobState,
  ScheduleResult,
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

export async function runScheduler(
  input: RunSchedulerInput,
): Promise<ScheduleResult> {
  const mode: GovernorMode = input.options?.mode ?? "BALANCED";
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

  const concurrency = Math.min(
    governor.maxConcurrency,
    resources.recommendedConcurrency,
    input.options?.maxConcurrency ?? governor.maxConcurrency,
  );

  const dag = new JobDag();
  dag.addMany(input.jobs);
  const validation = dag.validate();
  if (!validation.ok) {
    throw new Error(`Invalid job DAG: ${validation.errors.join("; ")}`);
  }

  let cu = createCuBudget(governor.maxCu);
  let cacheHits = 0;
  const wallStart = Date.now();
  let cancelledRemaining = false;

  const running = new Map<string, Promise<void>>();

  const pump = async (): Promise<void> => {
    while (dag.hasPending()) {
      if (Date.now() - wallStart > governor.maxWallMs) {
        cancelledRemaining = true;
        for (const j of dag.all()) {
          if (j.status === "pending" || j.status === "ready") {
            dag.setStatus(j.id, "cancelled", {
              error: "Cancelled: governor maxWallMs exceeded",
            });
          }
        }
        break;
      }

      // Wait if at concurrency cap
      if (running.size >= concurrency) {
        await Promise.race(running.values());
        continue;
      }

      const ready = dag
        .readyJobs()
        .filter((j) => j.status === "ready" && !running.has(j.id));

      if (ready.length === 0) {
        if (running.size === 0) {
          // Deadlock: pending jobs with unmet deps that aren't succeeding
          const stuck = dag
            .all()
            .filter((j) => j.status === "pending" || j.status === "ready");
          for (const j of stuck) {
            dag.setStatus(j.id, "cancelled", {
              error: "Cancelled: unmet dependencies or empty ready queue",
            });
          }
          break;
        }
        await Promise.race(running.values());
        continue;
      }

      const next = ready[0]!;
      const cost = next.estimatedCu || estimateCu(next.kind);
      if (!canAfford(cu, cost)) {
        // Try a cheaper ready job
        const cheaper = ready.find((j) =>
          canAfford(cu, j.estimatedCu || estimateCu(j.kind)),
        );
        if (!cheaper) {
          cancelledRemaining = true;
          for (const j of dag.all()) {
            if (j.status === "pending" || j.status === "ready") {
              dag.setStatus(j.id, "cancelled", {
                error: "Cancelled: CU budget exhausted",
              });
            }
          }
          break;
        }
        await startJob(cheaper);
      } else {
        await startJob(next);
      }
    }

    await Promise.all(running.values());
  };

  const startJob = async (job: JobState): Promise<void> => {
    const reserved = job.estimatedCu || estimateCu(job.kind);
    if (!canAfford(cu, reserved)) {
      return;
    }
    // Reserve CU immediately to avoid concurrent oversubscription.
    cu = chargeCu(cu, {
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
            cu = chargeCu(cu, {
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

  await pump();

  return {
    jobs: dag.all(),
    cu,
    resources,
    governor: { ...governor, maxConcurrency: concurrency },
    wallMs: Date.now() - wallStart,
    cacheHits,
    cancelledRemaining,
  };
}
