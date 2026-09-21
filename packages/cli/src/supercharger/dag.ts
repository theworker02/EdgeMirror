/**
 * Job DAG — schedulable EdgeMirror operations.
 *
 * Hot-path notes (large fan-out):
 * - Independent jobs (no deps) are enqueued once and drained without rescanning.
 * - Ready set is maintained incrementally; avoid O(n) all()+sort each tick.
 */

import type { JobSpec, JobState, JobStatus } from "./types.js";

export class JobDag {
  private readonly jobs = new Map<string, JobState>();
  /** Dependents index: depId → job ids that list it in dependsOn */
  private readonly dependents = new Map<string, string[]>();
  /** Jobs ready to run (deps satisfied), ordered by priority then insert order */
  private readonly readyQueue: JobState[] = [];
  private readyDirty = false;
  private pendingCount = 0;
  private readyCount = 0;
  private runningCount = 0;

  add(spec: JobSpec): void {
    if (this.jobs.has(spec.id)) {
      throw new Error(`Duplicate job id: ${spec.id}`);
    }
    const state: JobState = { ...spec, status: "pending" };
    this.jobs.set(spec.id, state);
    this.pendingCount += 1;
    for (const dep of spec.dependsOn) {
      const list = this.dependents.get(dep);
      if (list) list.push(spec.id);
      else this.dependents.set(dep, [spec.id]);
    }
  }

  addMany(specs: JobSpec[]): void {
    // Fast path: all independent — O(n) insert, no topological search.
    if (specs.every((s) => s.dependsOn.length === 0)) {
      for (const s of specs) this.add(s);
      this.seedReadyQueue();
      return;
    }

    // Insert in dependency-friendly order when possible
    const remaining = [...specs];
    const added = new Set<string>();
    let guard = remaining.length * remaining.length + 1;
    while (remaining.length && guard-- > 0) {
      const idx = remaining.findIndex((s) =>
        s.dependsOn.every((d) => added.has(d) || this.jobs.has(d)),
      );
      if (idx < 0) {
        for (const s of remaining) this.add(s);
        remaining.length = 0;
        break;
      }
      const [spec] = remaining.splice(idx, 1);
      this.add(spec!);
      added.add(spec!.id);
    }
    this.seedReadyQueue();
  }

  get(id: string): JobState | undefined {
    return this.jobs.get(id);
  }

  all(): JobState[] {
    return [...this.jobs.values()];
  }

  size(): number {
    return this.jobs.size;
  }

  validate(): { ok: true } | { ok: false; errors: string[] } {
    const errors: string[] = [];
    for (const job of this.jobs.values()) {
      for (const dep of job.dependsOn) {
        if (!this.jobs.has(dep)) {
          errors.push(`Job ${job.id} depends on missing ${dep}`);
        }
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): boolean => {
      if (visited.has(id)) return false;
      if (visiting.has(id)) return true;
      visiting.add(id);
      const job = this.jobs.get(id);
      if (job) {
        for (const dep of job.dependsOn) {
          if (visit(dep)) return true;
        }
      }
      visiting.delete(id);
      visited.add(id);
      return false;
    };
    for (const id of this.jobs.keys()) {
      if (visit(id)) errors.push(`Cycle detected involving ${id}`);
    }
    return errors.length ? { ok: false, errors } : { ok: true };
  }

  /** Ensure jobs with satisfied deps are in the ready queue. */
  private seedReadyQueue(): void {
    for (const job of this.jobs.values()) {
      if (job.status === "pending" && this.depsSatisfied(job)) {
        this.markReady(job);
      }
    }
    this.sortReadyQueue();
  }

  private depsSatisfied(job: JobState): boolean {
    for (const d of job.dependsOn) {
      const dep = this.jobs.get(d);
      if (!dep || (dep.status !== "succeeded" && dep.status !== "skipped")) {
        return false;
      }
    }
    return true;
  }

  private markReady(job: JobState): void {
    if (job.status !== "pending") return;
    job.status = "ready";
    this.pendingCount -= 1;
    this.readyCount += 1;
    this.readyQueue.push(job);
    this.readyDirty = true;
  }

  private sortReadyQueue(): void {
    if (!this.readyDirty) return;
    this.readyQueue.sort(
      (a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    this.readyDirty = false;
  }

  /**
   * Pop up to `limit` ready jobs (highest priority first).
   * Prefer this over readyJobs() on the hot path.
   * Callers that do not start a popped job must `returnReady` it.
   */
  takeReady(limit: number): JobState[] {
    if (limit <= 0) return [];
    if (this.readyQueue.length === 0 && this.pendingCount > 0) {
      this.seedReadyQueue();
    }
    if (this.readyQueue.length === 0) return [];
    this.sortReadyQueue();
    const out: JobState[] = [];
    while (out.length < limit && this.readyQueue.length > 0) {
      const job = this.readyQueue.shift()!;
      if (job.status !== "ready") continue;
      out.push(job);
    }
    return out;
  }

  /** Return a ready job that was taken but not started. */
  returnReady(job: JobState): void {
    if (job.status !== "ready") return;
    this.readyQueue.push(job);
    this.readyDirty = true;
  }

  /** @deprecated Prefer takeReady for scheduling; kept for tests/diagnostics. */
  readyJobs(): JobState[] {
    this.seedReadyQueue();
    this.sortReadyQueue();
    return this.readyQueue.filter((j) => j.status === "ready").slice();
  }

  setStatus(id: string, status: JobStatus, patch?: Partial<JobState>): void {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown job ${id}`);
    const prev = job.status;
    if (patch) Object.assign(job, patch);
    job.status = status;

    if (prev === "pending") this.pendingCount -= 1;
    else if (prev === "ready") {
      this.readyCount -= 1;
      if (status !== "ready") {
        const idx = this.readyQueue.indexOf(job);
        if (idx >= 0) this.readyQueue.splice(idx, 1);
      }
    } else if (prev === "running") this.runningCount -= 1;

    if (status === "pending") this.pendingCount += 1;
    else if (status === "ready") {
      this.readyCount += 1;
      if (prev !== "ready") {
        this.readyQueue.push(job);
        this.readyDirty = true;
      }
    } else if (status === "running") this.runningCount += 1;

    // When a job succeeds/skips, unlock dependents without full DAG scan.
    if (status === "succeeded" || status === "skipped") {
      const kids = this.dependents.get(id);
      if (kids) {
        for (const kidId of kids) {
          const kid = this.jobs.get(kidId);
          if (kid && kid.status === "pending" && this.depsSatisfied(kid)) {
            this.markReady(kid);
          }
        }
      }
    }
  }

  hasPending(): boolean {
    return this.pendingCount + this.readyCount + this.runningCount > 0;
  }

  failDependents(failedId: string): void {
    const kids = this.dependents.get(failedId);
    if (!kids) return;
    for (const kidId of kids) {
      const job = this.jobs.get(kidId);
      if (!job) continue;
      if (job.status === "pending" || job.status === "ready") {
        this.setStatus(kidId, "skipped", {
          error: `Skipped because dependency ${failedId} failed`,
        });
        this.failDependents(kidId);
      }
    }
  }
}

/**
 * Build a parity-suite DAG: prepare → N execute pairs → cleanup.
 * Independent execute_* jobs may run concurrently after prepare succeeds.
 */
export function buildParityDag(input: {
  testIds: string[];
  includeRemote: boolean;
  timeToConfidence?: boolean;
}): JobSpec[] {
  const specs: JobSpec[] = [
    {
      id: "discover",
      kind: "discover",
      name: "Discover project",
      priority: 0,
      estimatedCu: 1,
      dependsOn: [],
    },
    {
      id: "prepare_local",
      kind: "prepare_local",
      name: "Prepare local runtime",
      priority: 0,
      estimatedCu: 10,
      dependsOn: ["discover"],
    },
  ];

  if (input.includeRemote) {
    specs.push({
      id: "prepare_remote",
      kind: "prepare_remote",
      name: "Prepare remote/preview",
      priority: 0,
      estimatedCu: 50,
      dependsOn: ["discover"],
    });
  }

  for (const testId of input.testIds) {
    const priority =
      input.timeToConfidence === false ? 2 : priorityForTest(testId);

    specs.push({
      id: `local:${testId}`,
      kind: "execute_local",
      name: `Local ${testId}`,
      priority,
      estimatedCu: 1,
      dependsOn: ["prepare_local"],
      meta: { testId },
    });

    if (input.includeRemote) {
      specs.push({
        id: `remote:${testId}`,
        kind: "execute_remote",
        name: `Remote ${testId}`,
        priority,
        estimatedCu: 5,
        dependsOn: ["prepare_remote"],
        meta: { testId },
      });
      specs.push({
        id: `diff:${testId}`,
        kind: "diff",
        name: `Diff ${testId}`,
        priority,
        estimatedCu: 1,
        dependsOn: [`local:${testId}`, `remote:${testId}`],
        meta: { testId },
      });
      specs.push({
        id: `evidence:${testId}`,
        kind: "evidence",
        name: `Evidence ${testId}`,
        priority,
        estimatedCu: 1,
        dependsOn: [`diff:${testId}`],
        meta: { testId },
      });
    } else {
      specs.push({
        id: `evidence:${testId}`,
        kind: "evidence",
        name: `Evidence ${testId}`,
        priority,
        estimatedCu: 1,
        dependsOn: [`local:${testId}`],
        meta: { testId },
      });
    }
  }

  specs.push({
    id: "cleanup",
    kind: "cleanup",
    name: "Cleanup",
    priority: 4,
    estimatedCu: 2,
    dependsOn: input.testIds.map((id) => `evidence:${id}`),
  });

  return specs;
}

export function priorityForTest(testId: string): 0 | 1 | 2 | 3 | 4 {
  const id = testId.toLowerCase();
  if (id.includes("root") || id.includes("health") || id.includes("deploy")) {
    return 0;
  }
  if (id.startsWith("http-")) return 1;
  if (id.includes("compat")) return 2;
  if (id.includes("fuzz") || id.includes("explor")) return 4;
  return 2;
}
