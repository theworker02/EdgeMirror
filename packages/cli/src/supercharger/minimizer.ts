/**
 * Parallel delta-debugging minimizer.
 * Present as Supercharger capability even when no prior minimizer module existed.
 */

import type { JobSpec } from "./types.js";
import { runScheduler } from "./scheduler.js";
import type { GovernorMode } from "./types.js";

export interface MinimizeInput<T> {
  /** Initial failing candidate list */
  candidates: T[];
  /** Return true if the subset still reproduces the failure */
  stillFails: (subset: T[]) => Promise<boolean> | boolean;
  /** Serialize candidate for job ids */
  keyOf: (item: T) => string;
  mode?: GovernorMode;
  maxConcurrency?: number;
}

export interface MinimizeResult<T> {
  minimized: T[];
  rounds: number;
  evaluations: number;
  wallMs: number;
  note: string;
}

/**
 * Parallel ddmin-inspired reduction: try removing chunks concurrently per round.
 */
export async function parallelMinimize<T>(
  input: MinimizeInput<T>,
): Promise<MinimizeResult<T>> {
  const start = Date.now();
  let current = [...input.candidates];
  let rounds = 0;
  let evaluations = 0;

  if (current.length === 0) {
    return {
      minimized: [],
      rounds: 0,
      evaluations: 0,
      wallMs: 0,
      note: "Empty candidate set.",
    };
  }

  // Confirm full set fails
  evaluations += 1;
  if (!(await input.stillFails(current))) {
    return {
      minimized: current,
      rounds: 0,
      evaluations,
      wallMs: Date.now() - start,
      note: "Initial candidate set did not fail — nothing to minimize.",
    };
  }

  while (current.length > 1) {
    rounds += 1;
    const n = current.length;
    const chunk = Math.max(1, Math.floor(n / 2));
    const subsets: T[][] = [];
    for (let i = 0; i < n; i += chunk) {
      const without = current.filter((_, idx) => idx < i || idx >= i + chunk);
      if (without.length > 0 && without.length < current.length) {
        subsets.push(without);
      }
    }
    // Also try each half
    if (chunk < n) {
      subsets.push(current.slice(0, chunk));
      subsets.push(current.slice(chunk));
    }

    // Deduplicate by key signature
    const seen = new Set<string>();
    const unique = subsets.filter((s) => {
      const sig = s.map(input.keyOf).sort().join("|");
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });

    const jobs: JobSpec[] = unique.map((_subset, i) => ({
      id: `min-r${rounds}-${i}`,
      kind: "minimize" as const,
      name: `Minimize probe ${i}`,
      priority: 1 as const,
      estimatedCu: 3,
      dependsOn: [],
      meta: { index: i },
    }));

    const outcomes: Array<{ index: number; fails: boolean; subset: T[] }> = [];
    await runScheduler({
      jobs,
      options: {
        enabled: true,
        mode: input.mode ?? "FAST",
        maxConcurrency: input.maxConcurrency,
      },
      execute: async (job) => {
        const index = job.meta?.index as number;
        const subset = unique[index]!;
        const fails = await input.stillFails(subset);
        evaluations += 1;
        outcomes.push({ index, fails, subset });
        return { cu: 3, result: { fails } };
      },
    });

    const smaller = outcomes
      .filter((o) => o.fails)
      .sort((a, b) => a.subset.length - b.subset.length)[0];

    if (!smaller || smaller.subset.length >= current.length) {
      break;
    }
    current = smaller.subset;
  }

  return {
    minimized: current,
    rounds,
    evaluations,
    wallMs: Date.now() - start,
    note:
      "Parallel minimizer measured evaluations only. Improvement is workload-dependent — no universal speedup claim.",
  };
}
