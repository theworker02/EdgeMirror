import type { ConfigurationFingerprint, ExecutionTrace, ParityTest } from "../trace/schema.js";

/**
 * Common execution interface for local and remote targets.
 */
export interface ExecutionTarget {
  readonly kind: "local" | "remote";
  prepare(): Promise<void>;
  execute(test: ParityTest): Promise<ExecutionTrace>;
  cleanup(): Promise<void>;
}

export interface ExecutionContext {
  projectRoot: string;
  wranglerConfigPath: string;
  configurationFingerprint: ConfigurationFingerprint;
  compatibilityDateOverride?: string;
  ownershipDir: string;
  /** Shared remote budget counters. */
  budget?: RemoteBudgetState;
}

export interface RemoteBudgetState {
  maxRuns: number;
  maxDurationMinutes: number;
  runsUsed: number;
  startedAt: number;
}

export function budgetExceeded(budget: RemoteBudgetState): string | undefined {
  if (budget.runsUsed >= budget.maxRuns) {
    return `Remote run budget exceeded (${budget.maxRuns} max)`;
  }
  const elapsedMin = (Date.now() - budget.startedAt) / 60_000;
  if (elapsedMin >= budget.maxDurationMinutes) {
    return `Remote duration budget exceeded (${budget.maxDurationMinutes} minutes)`;
  }
  return undefined;
}
