/**
 * Job DAG — schedulable EdgeMirror operations.
 */

import type { JobSpec, JobState, JobStatus } from "./types.js";

export class JobDag {
  private readonly jobs = new Map<string, JobState>();

  add(spec: JobSpec): void {
    if (this.jobs.has(spec.id)) {
      throw new Error(`Duplicate job id: ${spec.id}`);
    }
    for (const dep of spec.dependsOn) {
      if (!this.jobs.has(dep) && dep !== spec.id) {
        // Allow forward refs only if already present; otherwise require deps first
      }
    }
    this.jobs.set(spec.id, { ...spec, status: "pending" });
  }

  addMany(specs: JobSpec[]): void {
    // Insert in dependency-friendly order when possible
    const remaining = [...specs];
    const added = new Set<string>();
    let guard = remaining.length * remaining.length + 1;
    while (remaining.length && guard-- > 0) {
      const idx = remaining.findIndex((s) =>
        s.dependsOn.every((d) => added.has(d) || this.jobs.has(d)),
      );
      if (idx < 0) {
        // Cycle or missing dep — add rest and let validate catch
        for (const s of remaining) this.add(s);
        remaining.length = 0;
        break;
      }
      const [spec] = remaining.splice(idx, 1);
      this.add(spec!);
      added.add(spec!.id);
    }
  }

  get(id: string): JobState | undefined {
    return this.jobs.get(id);
  }

  all(): JobState[] {
    return [...this.jobs.values()];
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
    // Cycle detection (DFS)
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

  /** Jobs whose deps have succeeded (or been skipped as satisfied). */
  readyJobs(): JobState[] {
    return this.all()
      .filter((j) => j.status === "pending" || j.status === "ready")
      .filter((j) =>
        j.dependsOn.every((d) => {
          const dep = this.jobs.get(d);
          return dep && (dep.status === "succeeded" || dep.status === "skipped");
        }),
      )
      .map((j) => {
        if (j.status === "pending") j.status = "ready";
        return j;
      })
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  }

  setStatus(id: string, status: JobStatus, patch?: Partial<JobState>): void {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown job ${id}`);
    Object.assign(job, patch, { status });
  }

  hasPending(): boolean {
    return this.all().some(
      (j) =>
        j.status === "pending" ||
        j.status === "ready" ||
        j.status === "running",
    );
  }

  failDependents(failedId: string): void {
    for (const job of this.jobs.values()) {
      if (
        (job.status === "pending" || job.status === "ready") &&
        job.dependsOn.includes(failedId)
      ) {
        job.status = "skipped";
        job.error = `Skipped because dependency ${failedId} failed`;
        this.failDependents(job.id);
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
    // Time-to-confidence: root/health first
    const priority = input.timeToConfidence === false
      ? 2
      : priorityForTest(testId);

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
