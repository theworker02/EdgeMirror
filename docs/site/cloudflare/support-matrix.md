# Bindings support matrix

All EdgeMirror Cloudflare surfaces below are **STABLE** for discovery, local, remote, preview, and HTTP/WS-observable parity.

Source of truth: `edgemirror doctor --bindings` / `edgemirror doctor --support-report` (from `CLOUDFLARE_BINDING_SUPPORT`).

| Feature | discovery | local | remote | preview | parity |
|---------|-----------|-------|--------|---------|--------|
| HTTP fetch handler | STABLE | STABLE | STABLE | STABLE | STABLE |
| Plaintext vars | STABLE | STABLE | STABLE | STABLE | STABLE |
| KV | STABLE | STABLE | STABLE | STABLE | STABLE |
| D1 | STABLE | STABLE | STABLE | STABLE | STABLE |
| R2 | STABLE | STABLE | STABLE | STABLE | STABLE |
| Durable Objects | STABLE | STABLE | STABLE | STABLE | STABLE |
| Queues | STABLE | STABLE | STABLE | STABLE | STABLE |
| Service bindings | STABLE | STABLE | STABLE | STABLE | STABLE |
| Workflows | STABLE | STABLE | STABLE | STABLE | STABLE |
| Hyperdrive | STABLE | STABLE | STABLE | STABLE | STABLE |
| Vectorize | STABLE | STABLE | STABLE | STABLE | STABLE |
| Workers AI | STABLE | STABLE | STABLE | STABLE | STABLE |
| WebSockets | STABLE | STABLE | STABLE | STABLE | STABLE |
| Cron Triggers | STABLE | STABLE | STABLE | STABLE | STABLE |

Corpus / fixture: [`fixtures/bindings-http`](../../../fixtures/bindings-http).

Workers AI free-text is normalized before diff; markers and response shape are compared.
