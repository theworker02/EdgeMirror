/**
 * Supercharge plan — estimates labeled as estimates.
 */

import { buildParityDag } from "./dag.js";
import { estimateCu, CU_WEIGHTS } from "./cu.js";
import { resolveGovernor, listGovernors } from "./governors.js";
import { captureResources } from "./resources.js";
import type { GovernorMode, JobSpec } from "./types.js";

export interface PlanInput {
  testIds: string[];
  includeRemote?: boolean;
  mode?: GovernorMode;
  maxConcurrency?: number;
  maxCu?: number;
}

export interface SuperchargePlan {
  schemaVersion: "1.0";
  kind: "supercharge-plan";
  disclaimer: string;
  mode: GovernorMode;
  resources: ReturnType<typeof captureResources>;
  governor: ReturnType<typeof resolveGovernor>;
  jobs: Array<{ id: string; kind: string; priority: number; estimatedCu: number }>;
  totals: {
    jobs: number;
    estimatedCu: number;
    estimatedParallelWaves: number;
    /** Lower-bound wall estimate under ideal parallelism — ESTIMATE ONLY */
    estimatedWallMsLow: number;
    estimatedWallMsHigh: number;
  };
  governors: ReturnType<typeof listGovernors>;
}

export function buildSuperchargePlan(input: PlanInput): SuperchargePlan {
  const mode = input.mode ?? "BALANCED";
  const governor = resolveGovernor(mode, {
    maxConcurrency: input.maxConcurrency,
    maxCu: input.maxCu,
  });
  const resources = captureResources({
    mode,
    queueDepth: input.testIds.length,
  });
  const concurrency = Math.min(
    governor.maxConcurrency,
    resources.recommendedConcurrency,
  );

  const jobs: JobSpec[] = buildParityDag({
    testIds: input.testIds,
    includeRemote: Boolean(input.includeRemote),
    timeToConfidence: true,
  });

  const estimatedCu = jobs.reduce(
    (sum, j) => sum + (j.estimatedCu || estimateCu(j.kind)),
    0,
  );

  // Rough wave estimate: prepares serial-ish, executes fan-out
  const executeJobs = jobs.filter((j) =>
    j.kind === "execute_local" || j.kind === "execute_remote",
  ).length;
  const waves = Math.max(1, Math.ceil(executeJobs / concurrency)) + 2;
  const unitMs = 50; // placeholder unit — labeled estimate

  return {
    schemaVersion: "1.0",
    kind: "supercharge-plan",
    disclaimer:
      "ESTIMATES ONLY. Not a measured speedup. Wall times are heuristic from job counts × concurrency — run benchmarks/ for measurements.",
    mode,
    resources,
    governor: { ...governor, maxConcurrency: concurrency },
    jobs: jobs.map((j) => ({
      id: j.id,
      kind: j.kind,
      priority: j.priority,
      estimatedCu: j.estimatedCu,
    })),
    totals: {
      jobs: jobs.length,
      estimatedCu,
      estimatedParallelWaves: waves,
      estimatedWallMsLow: waves * unitMs,
      estimatedWallMsHigh: waves * unitMs * 20 + estimatedCu * 5,
    },
    governors: listGovernors(),
  };
}

export function formatPlan(plan: SuperchargePlan): string {
  const lines = [
    "EdgeMirror Supercharge plan",
    plan.disclaimer,
    "",
    `Mode:        ${plan.mode}`,
    `Concurrency: ${plan.governor.maxConcurrency} (cap)`,
    `CU budget:   ${plan.governor.maxCu} (accounting only — not currency)`,
    `Jobs:        ${plan.totals.jobs}`,
    `Est. CU:     ${plan.totals.estimatedCu}`,
    `Est. waves:  ${plan.totals.estimatedParallelWaves}`,
    `Est. wall:   ${plan.totals.estimatedWallMsLow}–${plan.totals.estimatedWallMsHigh} ms (heuristic)`,
    "",
    "CU weights (accounting):",
    ...Object.entries(CU_WEIGHTS).map(([k, v]) => `  ${k}: ${v}`),
    "",
    "Job DAG (priority order sample):",
    ...plan.jobs.slice(0, 30).map(
      (j) => `  [P${j.priority}] ${j.id}  cu≈${j.estimatedCu}`,
    ),
    plan.jobs.length > 30 ? `  … ${plan.jobs.length - 30} more` : "",
  ];
  return lines.filter(Boolean).join("\n");
}
