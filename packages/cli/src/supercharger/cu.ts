/**
 * Compute Unit (CU) accounting.
 *
 * CU measures estimated/actual resource cost of Supercharger jobs for budgets
 * and planning. CU is NOT cryptocurrency, blockchain, vouchers, or payment.
 */

import type { CuBudget, CuLedgerEntry, JobKind } from "./types.js";

/** Default CU weights — accounting heuristics, not prices. */
export const CU_WEIGHTS: Record<JobKind, number> = {
  discover: 1,
  prepare_local: 10,
  prepare_remote: 50,
  execute_local: 1,
  execute_remote: 5,
  normalize: 1,
  diff: 1,
  evidence: 1,
  minimize: 3,
  compat_cell: 8,
  cleanup: 2,
  custom: 1,
};

export function estimateCu(kind: JobKind, multiplier = 1): number {
  return Math.max(0, Math.round(CU_WEIGHTS[kind] * multiplier));
}

export function createCuBudget(limit: number): CuBudget {
  return { limit, used: 0, entries: [] };
}

export function canAfford(budget: CuBudget, cu: number): boolean {
  return budget.used + cu <= budget.limit;
}

export function chargeCu(
  budget: CuBudget,
  input: { jobId: string; kind: JobKind; cu: number; note?: string },
): CuBudget {
  if (input.cu < 0) {
    throw new Error("CU charge cannot be negative");
  }
  const entry: CuLedgerEntry = {
    at: new Date().toISOString(),
    jobId: input.jobId,
    kind: input.kind,
    cu: input.cu,
    note: input.note,
  };
  return {
    limit: budget.limit,
    used: budget.used + input.cu,
    entries: [...budget.entries, entry],
  };
}

export function formatCuReport(budget: CuBudget): string {
  const lines = [
    `CU budget: ${budget.used} / ${budget.limit} used`,
    `(CU = local resource accounting only — not currency)`,
  ];
  for (const e of budget.entries.slice(-20)) {
    lines.push(`  +${e.cu}  ${e.kind}  ${e.jobId}${e.note ? `  (${e.note})` : ""}`);
  }
  return lines.join("\n");
}
