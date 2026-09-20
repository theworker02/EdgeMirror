# Cloudflare support matrix

Generated from Agent 2 report `schemaVersion` 1.0 (`edgemirrorVersion` 0.1.0). Levels describe **EdgeMirror** capability, not Cloudflare product GA.

| Binding | Discovery | Local | Remote | Preview | Parity |
|---------|-----------|-------|--------|---------|--------|
| HTTP fetch handler | STABLE | STABLE | STABLE | STABLE | STABLE |
| Plaintext vars | STABLE | STABLE | STABLE | STABLE | BETA |
| KV | STABLE | BETA | BETA | BETA | EXPERIMENTAL |
| D1 | STABLE | BETA | BETA | BETA | EXPERIMENTAL |
| R2 | STABLE | BETA | BETA | BETA | EXPERIMENTAL |
| Durable Objects | STABLE | BETA | BETA | EXPERIMENTAL | EXPERIMENTAL |
| Queues | STABLE | EXPERIMENTAL | BETA | EXPERIMENTAL | UNSUPPORTED |
| Service bindings | STABLE | BETA | BETA | EXPERIMENTAL | EXPERIMENTAL |
| Workflows | STABLE | EXPERIMENTAL | EXPERIMENTAL | EXPERIMENTAL | UNSUPPORTED |
| Hyperdrive | STABLE | EXPERIMENTAL | BETA | EXPERIMENTAL | UNSUPPORTED |
| Vectorize | STABLE | EXPERIMENTAL | BETA | EXPERIMENTAL | UNSUPPORTED |
| Workers AI | STABLE | UNSUPPORTED | BETA | EXPERIMENTAL | UNSUPPORTED |
| WebSockets | UNSUPPORTED | EXPERIMENTAL | EXPERIMENTAL | EXPERIMENTAL | UNSUPPORTED |
| Cron Triggers | BETA | EXPERIMENTAL | BETA | UNSUPPORTED | UNSUPPORTED |

Only **HTTP fetch** has STABLE parity. Do not document other bindings as STABLE parity.

Regenerate after merge:

```bash
edgemirror doctor --support-report
edgemirror doctor --bindings
```

Details and notes: [CLOUDFLARE_INTEGRATION.md](../../CLOUDFLARE_INTEGRATION.md)
