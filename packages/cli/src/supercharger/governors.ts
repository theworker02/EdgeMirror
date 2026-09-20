/**
 * Governor modes — explicit resource ceilings.
 */

import type { GovernorLimits, GovernorMode } from "./types.js";

const GOVERNORS: Record<GovernorMode, Omit<GovernorLimits, "mode">> = {
  ECO: {
    maxConcurrency: 1,
    maxCu: 50,
    maxWallMs: 5 * 60_000,
    description: "Serial execution, low CU budget — minimize host load.",
  },
  BALANCED: {
    maxConcurrency: 4,
    maxCu: 200,
    maxWallMs: 15 * 60_000,
    description: "Default — modest parallelism within measured host capacity.",
  },
  FAST: {
    maxConcurrency: 8,
    maxCu: 500,
    maxWallMs: 30 * 60_000,
    description: "Higher concurrency for large local matrices; still capped.",
  },
  MAX: {
    maxConcurrency: 16,
    maxCu: 2000,
    maxWallMs: 60 * 60_000,
    description: "Highest local ceiling — still respects explicit overrides.",
  },
};

export function resolveGovernor(
  mode: GovernorMode = "BALANCED",
  overrides?: { maxConcurrency?: number; maxCu?: number; maxWallMs?: number },
): GovernorLimits {
  const base = GOVERNORS[mode];
  const maxConcurrency = Math.max(
    1,
    Math.min(base.maxConcurrency, overrides?.maxConcurrency ?? base.maxConcurrency),
  );
  const maxCu = Math.max(1, Math.min(base.maxCu, overrides?.maxCu ?? base.maxCu));
  const maxWallMs = Math.max(
    1_000,
    Math.min(base.maxWallMs, overrides?.maxWallMs ?? base.maxWallMs),
  );
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
