/**
 * Supercharger shared types.
 *
 * CU (Compute Units) are local resource-accounting tokens used for budgets and
 * planning. They are NOT currency, cryptocurrency, blockchain tokens, or
 * billable charges by themselves.
 */

export type GovernorMode = "ECO" | "BALANCED" | "FAST" | "MAX";

/** Priority bands — lower number = higher priority (time-to-confidence). */
export type JobPriority = 0 | 1 | 2 | 3 | 4;

export type JobKind =
  | "discover"
  | "prepare_local"
  | "prepare_remote"
  | "execute_local"
  | "execute_remote"
  | "normalize"
  | "diff"
  | "evidence"
  | "minimize"
  | "compat_cell"
  | "cleanup"
  | "custom";

export interface JobSpec {
  id: string;
  kind: JobKind;
  /** Human label for plans / logs */
  name: string;
  priority: JobPriority;
  /** Estimated CU cost before execution */
  estimatedCu: number;
  /** Job ids that must complete successfully first */
  dependsOn: string[];
  /** Optional payload for executors */
  meta?: Record<string, unknown>;
}

export type JobStatus =
  | "pending"
  | "ready"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled";

export interface JobState extends JobSpec {
  status: JobStatus;
  actualCu?: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  result?: unknown;
  cacheHit?: boolean;
}

export interface ResourceSnapshot {
  capturedAt: string;
  cpus: number;
  freeMemMb: number;
  totalMemMb: number;
  loadAvg1m?: number;
  platform: NodeJS.Platform;
  nodeVersion: string;
  /** Adaptive concurrency recommendation from this snapshot */
  recommendedConcurrency: number;
}

export interface GovernorLimits {
  mode: GovernorMode;
  maxConcurrency: number;
  maxCu: number;
  maxWallMs: number;
  /** Soft note for plans — estimates only */
  description: string;
}

export interface CuLedgerEntry {
  at: string;
  jobId: string;
  kind: JobKind;
  cu: number;
  note?: string;
}

export interface CuBudget {
  limit: number;
  used: number;
  entries: CuLedgerEntry[];
}

export interface SuperchargeOptions {
  enabled: boolean;
  mode?: GovernorMode;
  /** Explicit concurrency ceiling (overrides governor max if lower) */
  maxConcurrency?: number;
  /** Explicit CU ceiling */
  maxCu?: number;
  /** Prefer time-to-confidence ordering */
  timeToConfidence?: boolean;
  /** Use content-addressed cache for safe artifacts only */
  cache?: boolean;
  /** Selection mode for incremental runs */
  selection?: "full" | "fast" | "incremental" | "nightly";
  /** Cache directory override */
  cacheDir?: string;
}

export interface ScheduleResult {
  jobs: JobState[];
  cu: CuBudget;
  resources: ResourceSnapshot;
  governor: GovernorLimits;
  wallMs: number;
  cacheHits: number;
  cancelledRemaining: boolean;
}
