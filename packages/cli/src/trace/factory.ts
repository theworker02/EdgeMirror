import { createHash, randomUUID } from "node:crypto";
import type {
  BindingInteraction,
  BindingSummary,
  ConfigurationFingerprint,
  ConsoleLine,
  ExecutionObservations,
  ExecutionTargetKind,
  ExecutionTrace,
  ObservationField,
} from "./schema.js";
import { EDGEMIRROR_VERSION } from "../version.js";

export function unavailable<T>(reason: string): ObservationField<T> {
  return { availability: "unavailable", reason };
}

export function captured<T>(value: T): ObservationField<T> {
  return { availability: "captured", value };
}

export function notApplicable<T>(reason: string): ObservationField<T> {
  return { availability: "not_applicable", reason };
}

export function emptyBindingSummary(): BindingSummary {
  return {
    kv: 0,
    d1: 0,
    r2: 0,
    durableObjects: 0,
    queues: 0,
    serviceBindings: 0,
    workflows: 0,
    hyperdrive: 0,
    vectorize: 0,
    ai: 0,
    other: [],
  };
}

export function hashConfigFingerprint(
  parts: Omit<ConfigurationFingerprint, "configHash">,
): string {
  const payload = JSON.stringify(parts);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function createFingerprint(
  parts: Omit<ConfigurationFingerprint, "configHash">,
): ConfigurationFingerprint {
  return { ...parts, configHash: hashConfigFingerprint(parts) };
}

export function emptyObservations(): ExecutionObservations {
  return {
    http: {
      status: unavailable("not executed"),
      headers: unavailable("not executed"),
      body: unavailable("not executed"),
      bodyEncoding: unavailable("not executed"),
    },
    exception: unavailable("not executed"),
    console: unavailable("console capture not yet implemented"),
    durationMs: unavailable("not executed"),
    bindingInteractions: unavailable("binding instrumentation not yet implemented"),
    storageOperations: unavailable("storage instrumentation not yet implemented"),
    websocketLifecycle: unavailable("websocket capture not yet implemented"),
    durableObjectInteractions: unavailable(
      "durable object instrumentation not yet implemented",
    ),
    queueBehavior: unavailable("queue instrumentation not yet implemented"),
    requestOrdering: notApplicable("single request"),
    responseOrdering: notApplicable("single response"),
    runtime: {
      runtimeName: unavailable("unknown"),
      runtimeVersion: unavailable("unknown"),
      wranglerVersion: unavailable("unknown"),
      compatibilityDate: unavailable("unknown"),
      compatibilityFlags: unavailable("unknown"),
      platformHints: unavailable("unknown"),
    },
    notes: [],
  };
}

export function createTrace(input: {
  testId: string;
  target: ExecutionTargetKind;
  status: ExecutionTrace["status"];
  statusReason?: string;
  configurationFingerprint: ConfigurationFingerprint;
  observations?: ExecutionObservations;
  redactions?: string[];
  rawError?: string;
}): ExecutionTrace {
  return {
    schemaVersion: "1.0",
    traceId: randomUUID(),
    testId: input.testId,
    target: input.target,
    timestamp: new Date().toISOString(),
    edgemirrorVersion: EDGEMIRROR_VERSION,
    status: input.status,
    statusReason: input.statusReason,
    configurationFingerprint: input.configurationFingerprint,
    observations: input.observations ?? emptyObservations(),
    redactions: input.redactions ?? [],
    rawError: input.rawError,
  };
}

export function headersFromFetch(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

export function summarizeConsole(_lines: ConsoleLine[]): ObservationField<ConsoleLine[]> {
  return unavailable("console capture not yet implemented");
}

export function summarizeBindings(
  _ops: BindingInteraction[],
): ObservationField<BindingInteraction[]> {
  return unavailable("binding instrumentation not yet implemented");
}
