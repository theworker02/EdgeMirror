/**
 * Honest Cloudflare Workers binding / feature support matrix.
 * Levels reflect EdgeMirror parity capability — not Cloudflare product maturity.
 */

export type SupportLevel =
  | "STABLE"
  | "BETA"
  | "EXPERIMENTAL"
  | "UNSUPPORTED";

export interface BindingFeatureSupport {
  id: string;
  name: string;
  /** Wrangler config keys that declare this binding/feature */
  wranglerKeys: string[];
  /** Config discovery / summarization */
  discovery: SupportLevel;
  /** Local workerd / wrangler dev execution */
  local: SupportLevel;
  /** Remote workers.dev / production-like deploy */
  remote: SupportLevel;
  /** Preview / versions upload */
  preview: SupportLevel;
  /** Differential parity comparison for this surface */
  parity: SupportLevel;
  notes: string;
}

/**
 * Accurate support as of EdgeMirror Phase 4 Cloudflare adapter work.
 * Do not mark STABLE parity unless traces are actually compared for that surface.
 */
export const CLOUDFLARE_BINDING_SUPPORT: BindingFeatureSupport[] = [
  {
    id: "http-fetch",
    name: "Workers HTTP fetch handler",
    wranglerKeys: ["main"],
    discovery: "STABLE",
    local: "STABLE",
    remote: "STABLE",
    preview: "STABLE",
    parity: "STABLE",
    notes:
      "Primary parity surface: status, body, headers via wrangler dev --local vs remote/preview.",
  },
  {
    id: "vars",
    name: "Plaintext vars",
    wranglerKeys: ["vars"],
    discovery: "STABLE",
    local: "STABLE",
    remote: "STABLE",
    preview: "STABLE",
    parity: "BETA",
    notes:
      "Vars are deployed with the Worker; parity observes HTTP effects only, not env dumps.",
  },
  {
    id: "kv",
    name: "KV namespaces",
    wranglerKeys: ["kv_namespaces"],
    discovery: "STABLE",
    local: "BETA",
    remote: "BETA",
    preview: "BETA",
    parity: "EXPERIMENTAL",
    notes:
      "Detected in wrangler config. Local uses wrangler simulators; binding interaction traces not yet captured.",
  },
  {
    id: "d1",
    name: "D1 databases",
    wranglerKeys: ["d1_databases"],
    discovery: "STABLE",
    local: "BETA",
    remote: "BETA",
    preview: "BETA",
    parity: "EXPERIMENTAL",
    notes:
      "Config summarization only; SQL interaction instrumentation is not implemented.",
  },
  {
    id: "r2",
    name: "R2 buckets",
    wranglerKeys: ["r2_buckets"],
    discovery: "STABLE",
    local: "BETA",
    remote: "BETA",
    preview: "BETA",
    parity: "EXPERIMENTAL",
    notes: "Detected in config; object I/O not instrumented for parity.",
  },
  {
    id: "durable-objects",
    name: "Durable Objects",
    wranglerKeys: ["durable_objects"],
    discovery: "STABLE",
    local: "BETA",
    remote: "BETA",
    preview: "EXPERIMENTAL",
    parity: "EXPERIMENTAL",
    notes:
      "Bindings counted; DO interaction traces marked unavailable until instrumentation lands.",
  },
  {
    id: "queues",
    name: "Queues (producers/consumers)",
    wranglerKeys: ["queues"],
    discovery: "STABLE",
    local: "EXPERIMENTAL",
    remote: "BETA",
    preview: "EXPERIMENTAL",
    parity: "UNSUPPORTED",
    notes:
      "Async queue behavior is not compared in the HTTP corpus; would produce false findings if forced.",
  },
  {
    id: "service-bindings",
    name: "Service bindings",
    wranglerKeys: ["services"],
    discovery: "STABLE",
    local: "BETA",
    remote: "BETA",
    preview: "EXPERIMENTAL",
    parity: "EXPERIMENTAL",
    notes:
      "Declared services are counted; multi-Worker orchestrated parity is not automatic.",
  },
  {
    id: "workflows",
    name: "Workflows",
    wranglerKeys: ["workflows"],
    discovery: "STABLE",
    local: "EXPERIMENTAL",
    remote: "EXPERIMENTAL",
    preview: "EXPERIMENTAL",
    parity: "UNSUPPORTED",
    notes: "Long-running workflow steps are outside the HTTP parity corpus.",
  },
  {
    id: "hyperdrive",
    name: "Hyperdrive",
    wranglerKeys: ["hyperdrive"],
    discovery: "STABLE",
    local: "EXPERIMENTAL",
    remote: "BETA",
    preview: "EXPERIMENTAL",
    parity: "UNSUPPORTED",
    notes: "Requires real Hyperdrive config; not simulated for parity.",
  },
  {
    id: "vectorize",
    name: "Vectorize",
    wranglerKeys: ["vectorize"],
    discovery: "STABLE",
    local: "EXPERIMENTAL",
    remote: "BETA",
    preview: "EXPERIMENTAL",
    parity: "UNSUPPORTED",
    notes: "Index operations not instrumented.",
  },
  {
    id: "workers-ai",
    name: "Workers AI",
    wranglerKeys: ["ai"],
    discovery: "STABLE",
    local: "UNSUPPORTED",
    remote: "BETA",
    preview: "EXPERIMENTAL",
    parity: "UNSUPPORTED",
    notes:
      "Model outputs are nondeterministic; EdgeMirror will not claim AI parity.",
  },
  {
    id: "websockets",
    name: "WebSockets",
    wranglerKeys: [],
    discovery: "UNSUPPORTED",
    local: "EXPERIMENTAL",
    remote: "EXPERIMENTAL",
    preview: "EXPERIMENTAL",
    parity: "UNSUPPORTED",
    notes:
      "WebSocket lifecycle capture is unavailable; not part of the default corpus.",
  },
  {
    id: "cron-triggers",
    name: "Cron Triggers",
    wranglerKeys: ["triggers", "crons"],
    discovery: "BETA",
    local: "EXPERIMENTAL",
    remote: "BETA",
    preview: "UNSUPPORTED",
    parity: "UNSUPPORTED",
    notes: "Scheduled invocations are not in the default HTTP corpus.",
  },
];

export function getBindingSupport(id: string): BindingFeatureSupport | undefined {
  return CLOUDFLARE_BINDING_SUPPORT.find((b) => b.id === id);
}

export function formatBindingsSupportTable(): string {
  const lines = [
    "Feature                      discovery  local        remote       preview      parity",
    "---------------------------- ---------- ------------ ------------ ------------ ------------",
  ];
  for (const b of CLOUDFLARE_BINDING_SUPPORT) {
    const name = b.name.padEnd(28).slice(0, 28);
    lines.push(
      `${name} ${b.discovery.padEnd(10)} ${b.local.padEnd(12)} ${b.remote.padEnd(12)} ${b.preview.padEnd(12)} ${b.parity}`,
    );
  }
  lines.push("");
  lines.push(
    "Levels describe EdgeMirror capability, not Cloudflare product status.",
  );
  return lines.join("\n");
}
