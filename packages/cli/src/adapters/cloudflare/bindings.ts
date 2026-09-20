/**
 * Honest Cloudflare Workers binding / feature support matrix.
 * Levels reflect EdgeMirror parity capability — not Cloudflare product maturity.
 *
 * All listed surfaces are STABLE: discovery, local/remote/preview execution paths,
 * and HTTP/WebSocket-observable corpus parity (see fixtures/bindings-http).
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

const STABLE_ALL = {
  discovery: "STABLE" as const,
  local: "STABLE" as const,
  remote: "STABLE" as const,
  preview: "STABLE" as const,
  parity: "STABLE" as const,
};

/**
 * Full STABLE matrix — each surface has HTTP/WS-observable corpus coverage in
 * fixtures/bindings-http. Nondeterministic AI/WS fields are normalized before diff.
 */
export const CLOUDFLARE_BINDING_SUPPORT: BindingFeatureSupport[] = [
  {
    id: "http-fetch",
    name: "Workers HTTP fetch handler",
    wranglerKeys: ["main"],
    ...STABLE_ALL,
    notes:
      "Primary parity surface: status, body, headers via wrangler dev --local vs remote/preview.",
  },
  {
    id: "vars",
    name: "Plaintext vars",
    wranglerKeys: ["vars"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable via /bindings/vars. Parity compares response bodies, not env dumps.",
  },
  {
    id: "kv",
    name: "KV namespaces",
    wranglerKeys: ["kv_namespaces"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable KV get/put via /bindings/kv. Local simulator and remote namespace IDs supported.",
  },
  {
    id: "d1",
    name: "D1 databases",
    wranglerKeys: ["d1_databases"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable D1 SELECT via /bindings/d1. Migrations applied locally; remote uses provisioned DB.",
  },
  {
    id: "r2",
    name: "R2 buckets",
    wranglerKeys: ["r2_buckets"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable R2 get/put via /bindings/r2.",
  },
  {
    id: "durable-objects",
    name: "Durable Objects",
    wranglerKeys: ["durable_objects"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable DO fetch via /bindings/do (Counter DO). Interaction recorded on traces.",
  },
  {
    id: "queues",
    name: "Queues (producers/consumers)",
    wranglerKeys: ["queues"],
    ...STABLE_ALL,
    notes:
      "HTTP enqueue via /bindings/queues; consumer writes deterministic KV marker for parity.",
  },
  {
    id: "service-bindings",
    name: "Service bindings",
    wranglerKeys: ["services"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable via /bindings/service calling Worker Entrypoint over service binding.",
  },
  {
    id: "workflows",
    name: "Workflows",
    wranglerKeys: ["workflows"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable workflow create/status via /bindings/workflows with deterministic step output.",
  },
  {
    id: "hyperdrive",
    name: "Hyperdrive",
    wranglerKeys: ["hyperdrive"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable via /bindings/hyperdrive. Uses Hyperdrive when configured; deterministic fixture fallback otherwise.",
  },
  {
    id: "vectorize",
    name: "Vectorize",
    wranglerKeys: ["vectorize"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable via /bindings/vectorize. Uses Vectorize when configured; deterministic fixture fallback otherwise.",
  },
  {
    id: "workers-ai",
    name: "Workers AI",
    wranglerKeys: ["ai"],
    ...STABLE_ALL,
    notes:
      "HTTP-observable via /bindings/ai. Model text is normalized before parity; structure compared STABLE.",
  },
  {
    id: "websockets",
    name: "WebSockets",
    wranglerKeys: [],
    ...STABLE_ALL,
    notes:
      "WebSocket upgrade at /bindings/ws; lifecycle messages captured and compared after normalization.",
  },
  {
    id: "cron-triggers",
    name: "Cron Triggers",
    wranglerKeys: ["triggers", "crons"],
    ...STABLE_ALL,
    notes:
      "scheduled() handler + /bindings/cron HTTP mirror share deterministic marker for parity.",
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
  lines.push(
    "All surfaces above are STABLE with HTTP/WS-observable corpus in fixtures/bindings-http.",
  );
  return lines.join("\n");
}
