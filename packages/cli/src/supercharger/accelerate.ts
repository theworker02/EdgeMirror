/**
 * Accelerate local execute fan-out via Supercharger scheduler.
 * Does not change evidence semantics — same traces/classifications as sequential.
 */

import type { ParityTest } from "../trace/schema.js";
import type { ExecutionTarget } from "../execution/types.js";
import { buildParityDag } from "./dag.js";
import { runScheduler } from "./scheduler.js";
import type { GovernorMode, ScheduleResult, SuperchargeOptions } from "./types.js";

export interface AccelerateLocalInput {
  tests: ParityTest[];
  local: ExecutionTarget;
  options?: SuperchargeOptions;
}

export interface AccelerateLocalResult {
  tracesByTestId: Map<string, Awaited<ReturnType<ExecutionTarget["execute"]>>>;
  schedule: ScheduleResult;
}

/**
 * Run independent local executes concurrently after prepare() has succeeded.
 */
export async function accelerateLocalExecutes(
  input: AccelerateLocalInput,
): Promise<AccelerateLocalResult> {
  const mode: GovernorMode = input.options?.mode ?? "BALANCED";
  const testIds = input.tests.map((t) => t.id);
  const byId = new Map(input.tests.map((t) => [t.id, t]));

  // Only schedule execute_local nodes (prepare already done by caller)
  const jobs = buildParityDag({
    testIds,
    includeRemote: false,
    timeToConfidence: input.options?.timeToConfidence !== false,
  }).filter((j) => j.kind === "execute_local");

  const tracesByTestId = new Map<
    string,
    Awaited<ReturnType<ExecutionTarget["execute"]>>
  >();

  const schedule = await runScheduler({
    jobs,
    options: {
      enabled: true,
      mode,
      maxConcurrency: input.options?.maxConcurrency,
      maxCu: input.options?.maxCu,
    },
    execute: async (job) => {
      const testId = String(job.meta?.testId ?? "");
      const test = byId.get(testId);
      if (!test) throw new Error(`Unknown test ${testId}`);
      const trace = await input.local.execute(test);
      tracesByTestId.set(testId, trace);
      return { cu: 1, result: { testId, status: trace.status } };
    },
  });

  return { tracesByTestId, schedule };
}
