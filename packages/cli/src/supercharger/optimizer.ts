/**
 * Supercharger optimization engine — CU budget selects different work.
 *
 * More CU must change something observable: deeper verification layers,
 * more tests, more compatibility dates, research workloads — not merely
 * "run the same suite with a higher counter."
 *
 * CU is resource accounting, not currency.
 */

import type { JobPriority, JobSpec } from "./types.js";
import { estimateCu } from "./cu.js";
import { priorityForTest } from "./dag.js";
import { MAX_SCHEDULE_JOBS } from "./governors.js";

export type VerificationDepth = 1 | 2 | 3 | 4;

export type WorkPackageId =
  | "required_parity"
  | "extended_parity"
  | "compat_matrix"
  | "historical_regression"
  | "differential_fuzz"
  | "research_swarm";

/** Expand a multi-CU package into independent 1-CU schedulable units. */
function buildUnitJobs(
  prefix: string,
  count: number,
  priority: JobPriority,
  packageId: WorkPackageId,
): JobSpec[] {
  const n = Math.max(0, Math.floor(count));
  const jobs: JobSpec[] = [];
  for (let i = 0; i < n; i++) {
    jobs.push({
      id: `${prefix}:${i}`,
      kind: "custom",
      name: `${prefix} unit ${i}`,
      priority,
      estimatedCu: 1,
      dependsOn: [],
      meta: { package: packageId, unit: i },
    });
  }
  return jobs;
}
export interface WorkPackage {
  id: WorkPackageId;
  /** Human label */
  name: string;
  depth: VerificationDepth;
  /** Explicit value factors (not a mysterious AI score) */
  factors: {
    deploymentRelevance: number; // 0–1
    changedCodeRelevance: number;
    historicalFailureProbability: number;
    coverageContribution: number;
    novelty: number;
  };
  /** Estimated CU for this package at given scale */
  estimateCu: (scale: PackageScale) => number;
  /** Build concrete jobs when selected */
  buildJobs: (scale: PackageScale) => JobSpec[];
}

export interface PackageScale {
  testIds: string[];
  compatDates: string[];
  includeRemote: boolean;
}

export interface OptimizeInput {
  budgetCu: number;
  testIds: string[];
  compatDates?: string[];
  includeRemote?: boolean;
  /** Require depth-1 packages even if budget is tiny (may exceed and mark insufficient) */
  requireEssential?: boolean;
}

export interface OptimizeResult {
  depth: VerificationDepth;
  budgetCu: number;
  selected: WorkPackageId[];
  deferred: WorkPackageId[];
  estimatedCu: number;
  jobs: JobSpec[];
  /** Why this budget produced this selection */
  rationale: string[];
  /** True when essential work exceeds budget */
  budgetInsufficientForEssential: boolean;
  valueDensity: Array<{ id: WorkPackageId; density: number; cost: number }>;
}

function scoreDensity(
  pkg: WorkPackage,
  cost: number,
): number {
  const f = pkg.factors;
  const value =
    f.deploymentRelevance * 5 +
    f.changedCodeRelevance * 3 +
    f.historicalFailureProbability * 2 +
    f.coverageContribution * 2 +
    f.novelty * 1;
  return cost <= 0 ? 0 : value / cost;
}

function buildParityJobs(
  testIds: string[],
  includeRemote: boolean,
  prefix: string,
): JobSpec[] {
  const jobs: JobSpec[] = [];
  for (const testId of testIds) {
    const p = priorityForTest(testId) as JobPriority;
    jobs.push({
      id: `${prefix}:local:${testId}`,
      kind: "execute_local",
      name: `Local ${testId}`,
      priority: p,
      estimatedCu: estimateCu("execute_local"),
      dependsOn: [],
      meta: { testId, package: prefix },
    });
    if (includeRemote) {
      jobs.push({
        id: `${prefix}:remote:${testId}`,
        kind: "execute_remote",
        name: `Remote ${testId}`,
        priority: p,
        estimatedCu: estimateCu("execute_remote"),
        dependsOn: [],
        meta: { testId, package: prefix },
      });
    }
  }
  return jobs;
}

const ESSENTIAL_IDS = new Set(["http-get-root", "http-get-health"]);

function pickEssential(testIds: string[]): string[] {
  const essential = testIds.filter((id) => ESSENTIAL_IDS.has(id) || priorityForTest(id) === 0);
  return essential.length > 0 ? essential : testIds.slice(0, Math.min(2, testIds.length));
}

function pickExtended(testIds: string[]): string[] {
  return testIds.filter((id) => !ESSENTIAL_IDS.has(id));
}

export const WORK_CATALOG: WorkPackage[] = [
  {
    id: "required_parity",
    name: "Required parity (deployment gate)",
    depth: 1,
    factors: {
      deploymentRelevance: 1,
      changedCodeRelevance: 0.9,
      historicalFailureProbability: 0.5,
      coverageContribution: 0.4,
      novelty: 0.1,
    },
    estimateCu: (s) =>
      pickEssential(s.testIds).length *
      (estimateCu("execute_local") + (s.includeRemote ? estimateCu("execute_remote") : 0)),
    buildJobs: (s) =>
      buildParityJobs(pickEssential(s.testIds), s.includeRemote, "required_parity"),
  },
  {
    id: "extended_parity",
    name: "Extended corpus parity",
    depth: 2,
    factors: {
      deploymentRelevance: 0.6,
      changedCodeRelevance: 0.5,
      historicalFailureProbability: 0.4,
      coverageContribution: 0.8,
      novelty: 0.2,
    },
    estimateCu: (s) =>
      pickExtended(s.testIds).length *
      (estimateCu("execute_local") + (s.includeRemote ? estimateCu("execute_remote") : 0)),
    buildJobs: (s) =>
      buildParityJobs(pickExtended(s.testIds), s.includeRemote, "extended_parity"),
  },
  {
    id: "compat_matrix",
    name: "Compatibility-date matrix",
    depth: 2,
    factors: {
      deploymentRelevance: 0.7,
      changedCodeRelevance: 0.3,
      historicalFailureProbability: 0.6,
      coverageContribution: 0.9,
      novelty: 0.4,
    },
    estimateCu: (s) => {
      const dates =
        s.compatDates.length > 0
          ? s.compatDates.length
          : 3; // matches default dates in buildJobs
      const tests = Math.min(pickEssential(s.testIds).length, 3);
      return dates * tests * estimateCu("compat_cell");
    },
    buildJobs: (s) => {
      const dates =
        s.compatDates.length > 0
          ? s.compatDates
          : ["2024-11-11", "2025-04-01", "2025-09-01"];
      const tests = pickEssential(s.testIds).slice(0, 3);
      const jobs: JobSpec[] = [];
      for (const date of dates) {
        for (const testId of tests) {
          // Expand each compat cell into 1-CU units (weight = compat_cell CU).
          const units = estimateCu("compat_cell");
          for (let u = 0; u < units; u++) {
            jobs.push({
              id: `compat:${date}:${testId}:${u}`,
              kind: "compat_cell",
              name: `Compat ${date} ${testId} #${u}`,
              priority: 2,
              estimatedCu: 1,
              dependsOn: [],
              meta: {
                compatibilityDate: date,
                testId,
                package: "compat_matrix",
                unit: u,
              },
            });
          }
        }
      }
      return jobs;
    },
  },
  {
    id: "historical_regression",
    name: "Historical regression fixtures",
    depth: 3,
    factors: {
      deploymentRelevance: 0.4,
      changedCodeRelevance: 0.2,
      historicalFailureProbability: 0.9,
      coverageContribution: 0.7,
      novelty: 0.3,
    },
    estimateCu: () => 40,
    buildJobs: () =>
      buildUnitJobs("historical", 40, 3, "historical_regression"),
  },
  {
    id: "differential_fuzz",
    name: "Differential fuzz / hunt",
    depth: 4,
    factors: {
      deploymentRelevance: 0.2,
      changedCodeRelevance: 0.1,
      historicalFailureProbability: 0.3,
      coverageContribution: 0.5,
      novelty: 1,
    },
    estimateCu: () => 80,
    buildJobs: () => buildUnitJobs("fuzz", 80, 4, "differential_fuzz"),
  },
  {
    id: "research_swarm",
    name: "Research swarm (post-gate)",
    depth: 4,
    factors: {
      deploymentRelevance: 0.1,
      changedCodeRelevance: 0.1,
      historicalFailureProbability: 0.2,
      coverageContribution: 0.4,
      novelty: 0.9,
    },
    estimateCu: () => 100,
    buildJobs: () => buildUnitJobs("research", 100, 4, "research_swarm"),
  },
];

function depthFromSelected(ids: WorkPackageId[]): VerificationDepth {
  let max: VerificationDepth = 1;
  for (const id of ids) {
    const pkg = WORK_CATALOG.find((p) => p.id === id);
    if (pkg && pkg.depth > max) max = pkg.depth;
  }
  return max;
}

/**
 * Select work packages under a CU budget using value density.
 * Essential (depth 1) is always preferred first.
 */
export function optimizeForBudget(input: OptimizeInput): OptimizeResult {
  const scale: PackageScale = {
    testIds: input.testIds,
    compatDates: input.compatDates ?? [],
    includeRemote: Boolean(input.includeRemote),
  };
  const requireEssential = input.requireEssential !== false;
  const rationale: string[] = [
    `Budget ${input.budgetCu} CU (accounting only — not currency).`,
  ];

  const priced = WORK_CATALOG.map((pkg) => {
    const cost = pkg.estimateCu(scale);
    return {
      pkg,
      cost,
      density: scoreDensity(pkg, cost),
    };
  });

  const selected: WorkPackageId[] = [];
  const deferred: WorkPackageId[] = [];
  let remaining = input.budgetCu;
  let budgetInsufficientForEssential = false;

  // Pass 1: essential packages (depth 1)
  const essential = priced.filter((p) => p.pkg.depth === 1);
  for (const item of essential) {
    if (item.cost <= remaining) {
      selected.push(item.pkg.id);
      remaining -= item.cost;
      rationale.push(
        `Selected ${item.pkg.id} (essential, cost ${item.cost} CU, density ${item.density.toFixed(3)}).`,
      );
    } else if (requireEssential) {
      budgetInsufficientForEssential = true;
      selected.push(item.pkg.id);
      remaining = 0;
      rationale.push(
        `Essential ${item.pkg.id} costs ${item.cost} CU > remaining budget — marked insufficient.`,
      );
    } else {
      deferred.push(item.pkg.id);
      rationale.push(`Deferred essential ${item.pkg.id} (cost ${item.cost}).`);
    }
  }

  // Pass 2: remaining by density (higher first), then lower depth first as tie-break
  const rest = priced
    .filter((p) => p.pkg.depth > 1)
    .sort((a, b) => {
      if (b.density !== a.density) return b.density - a.density;
      return a.pkg.depth - b.pkg.depth;
    });

  for (const item of rest) {
    if (item.cost <= remaining && remaining > 0) {
      selected.push(item.pkg.id);
      remaining -= item.cost;
      rationale.push(
        `Selected ${item.pkg.id} (cost ${item.cost} CU, density ${item.density.toFixed(3)}, depth ${item.pkg.depth}).`,
      );
    } else {
      deferred.push(item.pkg.id);
      rationale.push(
        `Deferred ${item.pkg.id} (cost ${item.cost} CU, remaining ${remaining}).`,
      );
    }
  }

  const jobs: JobSpec[] = [];
  for (const id of selected) {
    const pkg = WORK_CATALOG.find((p) => p.id === id)!;
    jobs.push(...pkg.buildJobs(scale));
  }

  // Spend remaining CU as independent 1-CU fan-out units so high budgets
  // schedule proportionally more parallel work (capped by MAX_SCHEDULE_JOBS).
  let estimatedCu = jobs.reduce((s, j) => s + j.estimatedCu, 0);
  let fanout = 0;
  while (
    estimatedCu < input.budgetCu &&
    jobs.length < MAX_SCHEDULE_JOBS
  ) {
    jobs.push({
      id: `fanout:${fanout}`,
      kind: "custom",
      name: `Budget fan-out ${fanout}`,
      priority: 4,
      estimatedCu: 1,
      dependsOn: [],
      meta: { package: "budget_fanout", unit: fanout },
    });
    estimatedCu += 1;
    fanout += 1;
  }
  if (fanout > 0) {
    rationale.push(
      `Expanded ${fanout} budget fan-out units (1 CU each) to utilize remaining CU under scheduler cap ${MAX_SCHEDULE_JOBS}.`,
    );
  }

  const depth = depthFromSelected(selected);

  rationale.push(
    `Achieved verification depth ${depth}. Scheduled ${jobs.length} jobs · estimated CU ${estimatedCu}.`,
  );

  return {
    depth,
    budgetCu: input.budgetCu,
    selected,
    deferred,
    estimatedCu,
    jobs,
    rationale,
    budgetInsufficientForEssential,
    valueDensity: priced.map((p) => ({
      id: p.pkg.id,
      density: p.density,
      cost: p.cost,
    })),
  };
}

/** Compare two budgets — used by tests and `supercharge plan --cu`. */
export function compareBudgets(
  lowCu: number,
  highCu: number,
  base: Omit<OptimizeInput, "budgetCu">,
): {
  low: OptimizeResult;
  high: OptimizeResult;
  addedPackages: WorkPackageId[];
  depthIncreased: boolean;
} {
  const low = optimizeForBudget({ ...base, budgetCu: lowCu });
  const high = optimizeForBudget({ ...base, budgetCu: highCu });
  const lowSet = new Set(low.selected);
  const addedPackages = high.selected.filter((id) => !lowSet.has(id));
  return {
    low,
    high,
    addedPackages,
    depthIncreased: high.depth > low.depth,
  };
}
