/**
 * Stable execution trace and parity result schemas.
 * Unavailable observations are represented explicitly — never invented.
 */

export type ExecutionTargetKind = "local" | "remote";

export type ObservationAvailability =
  | "captured"
  | "unavailable"
  | "redacted"
  | "not_applicable";

export interface ObservationField<T> {
  availability: ObservationAvailability;
  value?: T;
  reason?: string;
}

export interface HttpObservation {
  status: ObservationField<number>;
  headers: ObservationField<Record<string, string>>;
  body: ObservationField<string>;
  bodyEncoding: ObservationField<"utf8" | "base64" | "empty">;
}

export interface ExceptionObservation {
  name: string;
  message: string;
  stack?: string;
}

export interface ConsoleLine {
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
}

export interface BindingInteraction {
  binding: string;
  operation: string;
  details?: Record<string, unknown>;
}

export interface RuntimeMetadata {
  runtimeName: ObservationField<string>;
  runtimeVersion: ObservationField<string>;
  wranglerVersion: ObservationField<string>;
  compatibilityDate: ObservationField<string>;
  compatibilityFlags: ObservationField<string[]>;
  platformHints: ObservationField<Record<string, unknown>>;
}

export interface ExecutionObservations {
  http: HttpObservation;
  exception: ObservationField<ExceptionObservation | null>;
  console: ObservationField<ConsoleLine[]>;
  durationMs: ObservationField<number>;
  bindingInteractions: ObservationField<BindingInteraction[]>;
  storageOperations: ObservationField<BindingInteraction[]>;
  websocketLifecycle: ObservationField<unknown[]>;
  durableObjectInteractions: ObservationField<BindingInteraction[]>;
  queueBehavior: ObservationField<unknown[]>;
  requestOrdering: ObservationField<string[]>;
  responseOrdering: ObservationField<string[]>;
  runtime: RuntimeMetadata;
  /** Free-form notes when a category could not be observed. */
  notes: string[];
}

export interface ConfigurationFingerprint {
  projectRoot: string;
  workerName?: string;
  entryPoint?: string;
  compatibilityDate?: string;
  compatibilityFlags: string[];
  bindings: BindingSummary;
  configHash: string;
}

export interface BindingSummary {
  kv: number;
  d1: number;
  r2: number;
  durableObjects: number;
  queues: number;
  serviceBindings: number;
  workflows: number;
  hyperdrive: number;
  vectorize: number;
  ai: number;
  other: string[];
}

export interface ExecutionTrace {
  schemaVersion: "1.0";
  traceId: string;
  testId: string;
  target: ExecutionTargetKind;
  timestamp: string;
  edgemirrorVersion: string;
  /** Present when remote could not run. */
  status:
    | "ok"
    | "error"
    | "REMOTE_NOT_CONFIGURED"
    | "BUDGET_EXCEEDED"
    | "SKIPPED";
  statusReason?: string;
  configurationFingerprint: ConfigurationFingerprint;
  observations: ExecutionObservations;
  /** Applied privacy redactionsactions before persistence. */
  redactions: string[];
  rawError?: string;
}

export type ParityClassification =
  | "MATCH"
  | "EXPECTED_DIFFERENCE"
  | "CONFIGURATION_DIFFERENCE"
  | "APPLICATION_NONDETERMINISM"
  | "POSSIBLE_RUNTIME_DIVERGENCE"
  | "RUNTIME_DIVERGENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "REMOTE_NOT_CONFIGURED";

export interface Difference {
  path: string;
  local: unknown;
  remote: unknown;
  severity: "info" | "warning" | "error";
  note?: string;
}

export interface Evidence {
  kind: string;
  description: string;
  artifactPath?: string;
  hash?: string;
}

export interface ParityResult {
  testId: string;
  findingId?: string;
  classification: ParityClassification;
  differences: Difference[];
  evidence: Evidence[];
  confidence: number;
  localRuns: number;
  remoteRuns: number;
  localMatches: number;
  remoteMatches: number;
  localTraceIds: string[];
  remoteTraceIds: string[];
  normalizationRulesApplied: string[];
  parityContribution: 0 | 1 | null;
}

export interface ParityScoreBreakdown {
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
}

export interface ParityTestRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ParityTest {
  id: string;
  name: string;
  description?: string;
  feature?: string;
  category?: string;
  request: ParityTestRequest;
  /** Optional expected classification hint for corpus fixtures. */
  expectedBehavior?: "parity" | "expected_difference";
  compatibilityDates?: string[];
}

export interface EnvironmentFingerprint {
  runtime: string;
  runtimeVersion?: string;
  wrangler?: string;
  node: string;
  packageManager?: string;
  compatibilityDate?: string;
  compatibilityFlags: string[];
  entryPoint?: string;
  workerName?: string;
  bindings: BindingSummary;
  wranglerConfigPath?: string;
  projectRoot: string;
  cloudflareAuth: "configured" | "missing" | "unknown";
  detectedAt: string;
  edgemirrorVersion: string;
}
