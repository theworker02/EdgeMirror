import { describe, expect, it } from "vitest";
import { normalizeTrace, listNormalizationRules } from "../normalizer/index.js";
import {
  buildParityResult,
  classifyComparison,
  compareTraces,
  scoreParityResults,
} from "../diff/index.js";
import {
  captured,
  createFingerprint,
  createTrace,
  emptyBindingSummary,
  emptyObservations,
} from "../trace/factory.js";
import type { ExecutionTrace } from "../trace/schema.js";

function baseFingerprint() {
  return createFingerprint({
    projectRoot: "/tmp/proj",
    workerName: "test",
    entryPoint: "src/index.ts",
    compatibilityDate: "2025-04-01",
    compatibilityFlags: [],
    bindings: emptyBindingSummary(),
  });
}

function httpTrace(
  target: "local" | "remote",
  status: number,
  body: string,
  headers: Record<string, string> = {},
): ExecutionTrace {
  const obs = emptyObservations();
  obs.http.status = captured(status);
  obs.http.body = captured(body);
  obs.http.headers = captured(headers);
  obs.http.bodyEncoding = captured("utf8");
  obs.exception = captured(null);
  return createTrace({
    testId: "t1",
    target,
    status: "ok",
    configurationFingerprint: baseFingerprint(),
    observations: obs,
  });
}

describe("normalizer", () => {
  it("lists builtin rules", () => {
    const rules = listNormalizationRules();
    expect(rules.some((r) => r.id === "strip-transient-headers")).toBe(true);
  });

  it("strips cf-ray and dates from headers", () => {
    const trace = httpTrace("local", 200, "ok", {
      "cf-ray": "abc",
      date: "Wed, 01 Jan 2025 00:00:00 GMT",
      "content-type": "text/plain",
    });
    const { trace: normalized, applied } = normalizeTrace(trace);
    expect(applied).toContain("strip-transient-headers");
    const headers = normalized.observations.http.headers.value!;
    expect(headers["cf-ray"]).toBeUndefined();
    expect(headers["date"]).toBeUndefined();
    expect(headers["content-type"]).toBe("text/plain");
  });

  it("normalizes UUIDs and timestamps in body", () => {
    const body = JSON.stringify({
      id: "550e8400-e29b-41d4-a716-446655440000",
      at: "2025-04-01T12:00:00.000Z",
    });
    const { trace } = normalizeTrace(httpTrace("local", 200, body));
    const out = trace.observations.http.body.value!;
    expect(out).toContain("<uuid>");
    expect(out).toContain("<timestamp>");
  });
});

describe("diff engine", () => {
  it("matches identical responses after normalization", () => {
    const local = httpTrace("local", 200, "ok", {
      "content-type": "text/plain",
      "cf-ray": "local-ray",
    });
    const remote = httpTrace("remote", 200, "ok", {
      "content-type": "text/plain",
      "cf-ray": "remote-ray",
    });
    const { differences } = compareTraces(local, remote);
    const errors = differences.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
    expect(
      classifyComparison({ local, remote, differences }),
    ).toBe("MATCH");
  });

  it("detects status divergence", () => {
    const local = httpTrace("local", 200, "ok");
    const remote = httpTrace("remote", 500, "err");
    const result = buildParityResult({
      testId: "t1",
      local,
      remote,
      findingId: "EM-001",
    });
    expect(result.classification).toBe("RUNTIME_DIVERGENCE");
    expect(result.parityContribution).toBe(0);
  });

  it("returns REMOTE_NOT_CONFIGURED honestly", () => {
    const local = httpTrace("local", 200, "ok");
    const remote = createTrace({
      testId: "t1",
      target: "remote",
      status: "REMOTE_NOT_CONFIGURED",
      statusReason: "no creds",
      configurationFingerprint: baseFingerprint(),
    });
    const result = buildParityResult({ testId: "t1", local, remote });
    expect(result.classification).toBe("REMOTE_NOT_CONFIGURED");
    expect(result.parityContribution).toBeNull();
    expect(result.remoteRuns).toBe(0);
  });

  it("scores only comparable tests", () => {
    const local = httpTrace("local", 200, "ok");
    const remoteOk = httpTrace("remote", 200, "ok");
    const remoteMissing = createTrace({
      testId: "t2",
      target: "remote",
      status: "REMOTE_NOT_CONFIGURED",
      configurationFingerprint: baseFingerprint(),
    });
    const results = [
      buildParityResult({ testId: "t1", local, remote: remoteOk }),
      buildParityResult({
        testId: "t2",
        local,
        remote: remoteMissing,
      }),
    ];
    const score = scoreParityResults(results);
    expect(score.matched).toBe(1);
    expect(score.remoteNotConfigured).toBe(1);
    expect(score.overall).toBe(1);
  });

  it("classifies nondeterministic numeric bodies softly", () => {
    const local = httpTrace("local", 200, '{"n":1}');
    const remote = httpTrace("remote", 200, '{"n":2}');
    const { differences } = compareTraces(local, remote);
    expect(
      classifyComparison({ local, remote, differences }),
    ).toBe("APPLICATION_NONDETERMINISM");
  });
});
