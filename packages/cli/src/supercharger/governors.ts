/**
 * Governor modes — explicit resource ceilings.
 *
 * Explicit maxCu / maxConcurrency / maxWallMs overrides may EXCEED the mode
 * baseline. Modes are defaults, not hard caps on authorized budgets.
 */

import type { GovernorLimits, GovernorMode } from "./types.js";

/** Soft scheduler capacity — plans/microbenches may schedule up to this many jobs. */
export const MAX_SCHEDULE_JOBS = 10_000;

const GOVERNORS: Record<GovernorMode, Omit<GovernorLimits, "mode">> = {
  ECO: {
    maxConcurrency: 1,
    maxCu: 50,
    maxWallMs: 5 * 60_000,
    description: "Serial execution, low CU budget — minimize host load.",
  },
  BALANCED: {
    maxConcurrency: 8,
    maxCu: 500,
    maxWallMs: 15 * 60_000,
    description: "Default — modest parallelism within measured host capacity.",
  },
  FAST: {
    maxConcurrency: 32,
    maxCu: 2_000,
    maxWallMs: 30 * 60_000,
    description: "Higher concurrency for large local matrices; still capped by overrides.",
  },
  MAX: {
    maxConcurrency: 128,
    maxCu: 10_000,
    maxWallMs: 60 * 60_000,
    description:
      "Highest local default — aggressive fan-out for I/O-bound DAGs (may exceed via overrides).",
  },
};

export function resolveGovernor(
  mode: GovernorMode = "BALANCED",
  overrides?: { maxConcurrency?: number; maxCu?: number; maxWallMs?: number },
): GovernorLimits {
  const base = GOVERNORS[mode];
  // Overrides raise or lower the ceiling; they are not clamped to base.maxCu.
  const maxConcurrency = Math.max(
    1,
    overrides?.maxConcurrency ?? base.maxConcurrency,
  );
  const maxCu = Math.max(1, overrides?.maxCu ?? base.maxCu);
  const maxWallMs = Math.max(1_000, overrides?.maxWallMs ?? base.maxWallMs);
  return {
    mode,
    maxConcurrency,
    maxCu,
    maxWallMs,
    description: base.description,
  };
}

export function listGovernors(): GovernorLimits[] {
  return (Object.keys(GOVERNORS) as GovernorMode[]).map((mode) =>
    resolveGovernor(mode),
  );
}
