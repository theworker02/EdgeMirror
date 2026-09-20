/**
 * Compatibility matrix optimization — prune impossible combinations before execution.
 */

export interface MatrixCell {
  compatibilityDate: string;
  testId: string;
  flag?: string;
}

export interface MatrixPruneResult {
  keep: MatrixCell[];
  pruned: Array<MatrixCell & { reason: string }>;
  note: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Eliminate impossible / redundant matrix cells before running wrangler.
 */
export function pruneCompatMatrix(
  cells: MatrixCell[],
  opts?: {
    /** Known unsupported flag×date pairs */
    unsupported?: Array<{ flag: string; before?: string; after?: string }>;
    /** Drop duplicate date+test+flag */
    dedupe?: boolean;
  },
): MatrixPruneResult {
  const pruned: Array<MatrixCell & { reason: string }> = [];
  const keep: MatrixCell[] = [];
  const seen = new Set<string>();

  for (const cell of cells) {
    if (!DATE_RE.test(cell.compatibilityDate)) {
      pruned.push({
        ...cell,
        reason: "Invalid compatibility date format (expected YYYY-MM-DD)",
      });
      continue;
    }

    // Future-far dates that are clearly typos (year > current+2)
    const year = Number(cell.compatibilityDate.slice(0, 4));
    const maxYear = new Date().getFullYear() + 2;
    if (year < 2021 || year > maxYear) {
      pruned.push({
        ...cell,
        reason: `Compatibility date year ${year} outside plausible Workers range`,
      });
      continue;
    }

    if (cell.flag && opts?.unsupported) {
      const bad = opts.unsupported.find((u) => {
        if (u.flag !== cell.flag) return false;
        if (u.before && cell.compatibilityDate < u.before) return true;
        if (u.after && cell.compatibilityDate > u.after) return true;
        return false;
      });
      if (bad) {
        pruned.push({
          ...cell,
          reason: `Flag ${cell.flag} unsupported for date ${cell.compatibilityDate}`,
        });
        continue;
      }
    }

    const key = `${cell.compatibilityDate}|${cell.testId}|${cell.flag ?? ""}`;
    if (opts?.dedupe !== false) {
      if (seen.has(key)) {
        pruned.push({ ...cell, reason: "Duplicate cell" });
        continue;
      }
      seen.add(key);
    }

    keep.push(cell);
  }

  return {
    keep,
    pruned,
    note: `Pruned ${pruned.length} impossible/redundant cells before execution; ${keep.length} remain. Not a speedup claim.`,
  };
}

/**
 * Expand dates × tests into cells then prune.
 */
export function buildOptimizedMatrix(input: {
  dates: string[];
  testIds: string[];
  flags?: string[];
}): MatrixPruneResult {
  const cells: MatrixCell[] = [];
  const flags = input.flags?.length ? input.flags : [undefined];
  for (const date of input.dates) {
    for (const testId of input.testIds) {
      for (const flag of flags) {
        cells.push({
          compatibilityDate: date,
          testId,
          ...(flag ? { flag } : {}),
        });
      }
    }
  }
  return pruneCompatMatrix(cells);
}
