/**
 * Differential comparison + classification of local vs remote traces.
 */

import type {
  Difference,
  ExecutionTrace,
  ObservationField,
  ParityClassification,
  ParityResult,
} from "../trace/schema.js";
import { normalizeTrace } from "../normalizer/index.js";

function fieldValue<T>(field: ObservationField<T>): T | undefined {
  return field.availability === "captured" ? field.value : undefined;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object).sort();
    const bk = Object.keys(b as object).sort();
    if (!deepEqual(ak, bk)) return false;
    return ak.every((k) =>
      deepEqual(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k],
      ),
    );
  }
  return false;
}

function comparePath(
  path: string,
  local: unknown,
  remote: unknown,
  differences: Difference[],
  severity: Difference["severity"] = "error",
): void {
  if (!deepEqual(local, remote)) {
    differences.push({ path, local, remote, severity });
  }
}

export function compareTraces(
  localRaw: ExecutionTrace,
  remoteRaw: ExecutionTrace,
): { differences: Difference[]; applied: string[] } {
  const localNorm = normalizeTrace(localRaw);
  const remoteNorm = normalizeTrace(remoteRaw);
  const differences: Difference[] = [];

  comparePath(
    "http.status",
    fieldValue(localNorm.trace.observations.http.status),
    fieldValue(remoteNorm.trace.observations.http.status),
    differences,
  );
  comparePath(
    "http.body",
    fieldValue(localNorm.trace.observations.http.body),
    fieldValue(remoteNorm.trace.observations.http.body),
    differences,
  );
  comparePath(
    "http.headers",
    fieldValue(localNorm.trace.observations.http.headers),
    fieldValue(remoteNorm.trace.observations.http.headers),
    differences,
    "warning",
  );
  comparePath(
    "exception",
    fieldValue(localNorm.trace.observations.exception),
    fieldValue(remoteNorm.trace.observations.exception),
    differences,
  );

  return { differences, applied: localNorm.applied };
}

export function classifyComparison(input: {
  local: ExecutionTrace;
  remote: ExecutionTrace;
  differences: Difference[];
  expectedBehavior?: "parity" | "expected_difference";
}): ParityClassification {
  if (input.remote.status === "REMOTE_NOT_CONFIGURED") {
    return "REMOTE_NOT_CONFIGURED";
  }
  // Infrastructure / transport failures must never become RUNTIME_DIVERGENCE.
  if (
    input.local.status === "error" ||
    input.remote.status === "error" ||
    input.remote.status === "BUDGET_EXCEEDED" ||
    input.remote.status === "SKIPPED"
  ) {
    return "INSUFFICIENT_EVIDENCE";
  }
  if (input.local.status !== "ok" || input.remote.status !== "ok") {
    return "INSUFFICIENT_EVIDENCE";
  }

  const errors = input.differences.filter((d) => d.severity === "error");
  if (errors.length === 0) {
    return "MATCH";
  }

  if (input.expectedBehavior === "expected_difference") {
    return "EXPECTED_DIFFERENCE";
  }

  // Header-only or config fingerprint differences → softer class
  const onlyHeaders = errors.every((d) => d.path.startsWith("http.headers"));
  if (onlyHeaders) {
    return "CONFIGURATION_DIFFERENCE";
  }

  // Body differs with UUID/timestamp leftovers → possible nondeterminism
  const bodyDiff = errors.find((d) => d.path === "http.body");
  if (
    bodyDiff &&
    typeof bodyDiff.local === "string" &&
    typeof bodyDiff.remote === "string"
  ) {
    const localClean = bodyDiff.local.replace(/\d+/g, "N");
    const remoteClean = bodyDiff.remote.replace(/\d+/g, "N");
    if (localClean === remoteClean) {
      return "APPLICATION_NONDETERMINISM";
    }
  }

  if (errors.some((d) => d.path === "http.status" || d.path === "exception")) {
    return "RUNTIME_DIVERGENCE";
  }

  return "POSSIBLE_RUNTIME_DIVERGENCE";
}

export function buildParityResult(input: {
  testId: string;
  local: ExecutionTrace;
  remote: ExecutionTrace;
  expectedBehavior?: "parity" | "expected_difference";
  findingId?: string;
}): ParityResult {
  if (
    input.remote.status === "REMOTE_NOT_CONFIGURED" ||
    input.remote.status === "SKIPPED"
  ) {
    return {
      testId: input.testId,
      findingId: input.findingId,
      classification:
        input.remote.status === "REMOTE_NOT_CONFIGURED"
          ? "REMOTE_NOT_CONFIGURED"
          : "INSUFFICIENT_EVIDENCE",
      differences: [],
      evidence: [
        {
          kind: "status",
          description: input.remote.statusReason ?? input.remote.status,
        },
      ],
      confidence: 0,
      localRuns: input.local.status === "ok" ? 1 : 0,
      remoteRuns: 0,
      localMatches: 0,
      remoteMatches: 0,
      localTraceIds: [input.local.traceId],
      remoteTraceIds: [input.remote.traceId],
      normalizationRulesApplied: [],
      parityContribution: null,
    };
  }

  const { differences, applied } = compareTraces(input.local, input.remote);
  const classification = classifyComparison({
    local: input.local,
    remote: input.remote,
    differences,
    expectedBehavior: input.expectedBehavior,
  });

  const comparable =
    classification === "MATCH" ||
    classification === "EXPECTED_DIFFERENCE" ||
    classification === "RUNTIME_DIVERGENCE" ||
    classification === "POSSIBLE_RUNTIME_DIVERGENCE" ||
    classification === "CONFIGURATION_DIFFERENCE" ||
    classification === "APPLICATION_NONDETERMINISM";

  let parityContribution: 0 | 1 | null = null;
  if (comparable) {
    parityContribution =
      classification === "MATCH" || classification === "EXPECTED_DIFFERENCE"
        ? 1
        : 0;
  }

  const confidence =
    classification === "MATCH"
      ? 0.95
      : classification === "RUNTIME_DIVERGENCE"
        ? 0.85
        : classification === "INSUFFICIENT_EVIDENCE" ||
            classification === "REMOTE_NOT_CONFIGURED"
          ? 0
          : 0.6;

  return {
    testId: input.testId,
    findingId: input.findingId,
    classification,
    differences,
    evidence: [
      {
        kind: "trace",
        description: `local:${input.local.traceId}`,
      },
      {
        kind: "trace",
        description: `remote:${input.remote.traceId}`,
      },
    ],
    confidence,
    localRuns: 1,
    remoteRuns: input.remote.status === "ok" ? 1 : 0,
    localMatches: classification === "MATCH" ? 1 : 0,
    remoteMatches: classification === "MATCH" ? 1 : 0,
    localTraceIds: [input.local.traceId],
    remoteTraceIds: [input.remote.traceId],
    normalizationRulesApplied: applied,
    parityContribution,
  };
}

export function scoreParityResults(results: ParityResult[]): {
  overall: number | null;
  byCategory: Record<string, number | null>;
  executed: number;
  matched: number;
  divergent: number;
  insufficient: number;
  remoteNotConfigured: number;
  calculation:
    | "matched / (matched + divergent) among executed comparable tests"
    | "no comparable tests executed";
} {
  let matched = 0;
  let divergent = 0;
  let insufficient = 0;
  let remoteNotConfigured = 0;

  for (const r of results) {
    if (r.classification === "REMOTE_NOT_CONFIGURED") {
      remoteNotConfigured += 1;
      continue;
    }
    if (
      r.classification === "INSUFFICIENT_EVIDENCE" ||
      r.parityContribution === null
    ) {
      insufficient += 1;
      continue;
    }
    if (r.parityContribution === 1) matched += 1;
    else divergent += 1;
  }

  const denom = matched + divergent;
  return {
    overall: denom === 0 ? null : matched / denom,
    byCategory: {},
    executed: matched + divergent,
    matched,
    divergent,
    insufficient,
    remoteNotConfigured,
    calculation:
      denom === 0
        ? "no comparable tests executed"
        : "matched / (matched + divergent) among executed comparable tests",
  };
}
