/**
 * Nondeterminism normalization with inspectable rule IDs.
 * Rules strip or stabilize fields that differ between local and remote
 * without indicating a real behavioral divergence.
 */

import type { ExecutionTrace, ObservationField } from "../trace/schema.js";

export interface NormalizationRule {
  id: string;
  description: string;
  apply: (trace: ExecutionTrace) => ExecutionTrace;
}

const TRANSIENT_HEADERS = new Set([
  "date",
  "cf-ray",
  "cf-cache-status",
  "age",
  "x-request-id",
  "x-trace-id",
  "server",
  "report-to",
  "nel",
  "alt-svc",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
]);

function mapField<T>(
  field: ObservationField<T>,
  map: (value: T) => T,
): ObservationField<T> {
  if (field.availability !== "captured" || field.value === undefined) return field;
  return { ...field, value: map(field.value) };
}

export const BUILTIN_RULES: NormalizationRule[] = [
  {
    id: "strip-transient-headers",
    description: "Remove headers that vary per request (cf-ray, date, etc.)",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.http.headers = mapField(
        next.observations.http.headers,
        (headers) => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(headers)) {
            if (!TRANSIENT_HEADERS.has(k.toLowerCase())) out[k.toLowerCase()] = v;
          }
          return out;
        },
      );
      return next;
    },
  },
  {
    id: "normalize-header-case",
    description: "Lowercase all header names",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.http.headers = mapField(
        next.observations.http.headers,
        (headers) => {
          const out: Record<string, string> = {};
          for (const [k, v] of Object.entries(headers)) {
            out[k.toLowerCase()] = v;
          }
          return out;
        },
      );
      return next;
    },
  },
  {
    id: "strip-duration",
    description: "Duration is not comparable across environments",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.durationMs = {
        availability: "not_applicable",
        reason: "normalized: timing not compared",
      };
      return next;
    },
  },
  {
    id: "strip-uuid-like-body",
    description: "Replace UUID-like tokens in body with stable placeholders",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.http.body = mapField(next.observations.http.body, (body) =>
        body.replace(
          /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
          "<uuid>",
        ),
      );
      return next;
    },
  },
  {
    id: "strip-iso-timestamps-body",
    description: "Replace ISO-8601 timestamps in body",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.http.body = mapField(next.observations.http.body, (body) =>
        body.replace(
          /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/g,
          "<timestamp>",
        ),
      );
      return next;
    },
  },
  {
    id: "normalize-whitespace-body",
    description: "Trim body whitespace for comparison",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.http.body = mapField(next.observations.http.body, (body) =>
        body.trim(),
      );
      return next;
    },
  },
  {
    id: "strip-platform-runtime-hints",
    description: "Platform hints (cf-ray etc.) are expected to differ",
    apply(trace) {
      const next = structuredClone(trace);
      next.observations.runtime.platformHints = {
        availability: "not_applicable",
        reason: "normalized: platform hints not compared",
      };
      next.observations.runtime.runtimeName = {
        availability: "not_applicable",
        reason: "normalized: runtime name expected to differ local vs remote",
      };
      return next;
    },
  },
];

export function listNormalizationRules(): Array<{ id: string; description: string }> {
  return BUILTIN_RULES.map((r) => ({ id: r.id, description: r.description }));
}

export function normalizeTrace(
  trace: ExecutionTrace,
  ruleIds?: string[],
): { trace: ExecutionTrace; applied: string[] } {
  const rules =
    ruleIds === undefined
      ? BUILTIN_RULES
      : BUILTIN_RULES.filter((r) => ruleIds.includes(r.id));

  let current = structuredClone(trace);
  const applied: string[] = [];
  for (const rule of rules) {
    current = rule.apply(current);
    applied.push(rule.id);
  }
  return { trace: current, applied };
}
