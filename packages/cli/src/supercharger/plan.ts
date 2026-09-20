/**
 * Supercharge plan — estimates labeled as estimates.
 * CU budget changes which work packages are selected (optimizer).
 */

import { estimateCu, CU_WEIGHTS } from "./cu.js";
import { resolveGovernor, listGovernors } from "./governors.js";
import { captureResources } from "./resources.js";
import { optimizeForBudget, compareBudgets } from "./optimizer.js";
import type { GovernorMode } from "./types.js";

export interface PlanInput {
  testIds: string[];
  includeRemote?: boolean;
  mode?: GovernorMode;
  maxConcurrency?: number;
  maxCu?: number;
  compatDates?: string[];
}

export interface SuperchargePlan {
  schemaVersion: "1.1";
  kind: "supercharge-plan";
  disclaimer: string;
  mode: GovernorMode;
  resources: ReturnType<typeof captureResources>;
  governor: ReturnType<typeof resolveGovernor>;
  optimization: ReturnType<typeof optimizeForBudget>;
  jobs: Array<{ id: string; kind: string; priority: number; estimatedCu: number }>;
  totals: {
    jobs: number;
    estimatedCu: number;
    estimatedParallelWaves: number;
    estimatedWallMsLow: number;
    estimatedWallMsHigh: number;
    depth: number;
    selectedPackages: string[];
    deferredPackages: string[];
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

  const optimization = optimizeForBudget({
    budgetCu: governor.maxCu,
    testIds: input.testIds,
    compatDates: input.compatDates,
    includeRemote: Boolean(input.includeRemote),
  });

  const jobs = optimization.jobs;
  const estimatedCu = jobs.reduce(
    (sum, j) => sum + (j.estimatedCu || estimateCu(j.kind)),
    0,
  );

  const executeJobs = jobs.filter(
    (j) =>
      j.kind === "execute_local" ||
      j.kind === "execute_remote" ||
      j.kind === "compat_cell",
  ).length;
  const waves = Math.max(1, Math.ceil(executeJobs / concurrency)) + 2;
  const unitMs = 50;

  return {
    schemaVersion: "1.1",
    kind: "supercharge-plan",
    disclaimer:
      "ESTIMATES ONLY. Package selection is deterministic from CU budget + value density. Wall times are heuristic — run benchmarks for measurements. CU is not currency.",
    mode,
    resources,
    governor: { ...governor, maxConcurrency: concurrency },
    optimization,
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
      depth: optimization.depth,
      selectedPackages: optimization.selected,
      deferredPackages: optimization.deferred,
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
    `Depth:       ${plan.totals.depth}`,
    `Selected:    ${plan.totals.selectedPackages.join(", ") || "(none)"}`,
    `Deferred:    ${plan.totals.deferredPackages.join(", ") || "(none)"}`,
    `Jobs:        ${plan.totals.jobs}`,
    `Est. CU:     ${plan.totals.estimatedCu}`,
    `Est. waves:  ${plan.totals.estimatedParallelWaves}`,
    `Est. wall:   ${plan.totals.estimatedWallMsLow}–${plan.totals.estimatedWallMsHigh} ms (heuristic)`,
    "",
    "Rationale:",
    ...plan.optimization.rationale.map((r) => `  • ${r}`),
    "",
    "CU weights (accounting):",
    ...Object.entries(CU_WEIGHTS).map(([k, v]) => `  ${k}: ${v}`),
    "",
    "Job sample:",
    ...plan.jobs.slice(0, 30).map(
      (j) => `  [P${j.priority}] ${j.id}  cu≈${j.estimatedCu}`,
    ),
    plan.jobs.length > 30 ? `  … ${plan.jobs.length - 30} more` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export { compareBudgets, optimizeForBudget };
