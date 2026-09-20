# Cloudflare Integration

EdgeMirror targets Cloudflare Workers as the only production-quality runtime in Phase 1–3.

EdgeMirror is **not affiliated with** Cloudflare, Inc. Wrangler remains the deployment tool of record; `edgemirror deploy` only orchestrates verify → `wrangler deploy`.

## Source of truth

Binding and runtime support claims in this document come from Agent 2’s machine-readable report:

- Coordination copy: [`.agent/cloudflare-support-report.json`](../.agent/cloudflare-support-report.json) (from branch `agent/cloudflare`, HEAD `53477a6`)
- After merge: `edgemirror doctor --support-report` (and `edgemirror doctor --bindings`)

**Do not invent STABLE features.** If the report and this doc disagree, trust the report / regenerated doctor output.

Report metadata: `schemaVersion` 1.0, `edgemirrorVersion` 0.1.0, `generatedAt` 2026-09-20T01:16:17.476Z.

## Runtime surfaces (from report)

| Surface | Engine | Quality (EdgeMirror) |
|---------|--------|----------------------|
| Local | workerd via `wrangler dev --local` | Production-quality for HTTP parity |
| Remote | Isolated `edgemirror-tmp-*` Worker on workers.dev | Production-quality when credentials present |
| Preview | `wrangler versions upload` preview URL | Production-quality when credentials present; otherwise `REMOTE_NOT_CONFIGURED` / `PREVIEW_NOT_AVAILABLE` |

## Authentication (from report)

Supported:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL`
- Wrangler OAuth login

Preferred env for automation: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

When missing: **`REMOTE_NOT_CONFIGURED`** — never fabricated remote traces.

## Bindings support matrix (from report)

Levels describe **EdgeMirror capability**, not Cloudflare product GA status.

| ID | Name | Discovery | Local | Remote | Preview | Parity | Notes (summary) |
|----|------|-----------|-------|--------|---------|--------|-----------------|
| `http-fetch` | Workers HTTP fetch handler | STABLE | STABLE | STABLE | STABLE | STABLE | Primary parity surface: status/body/headers |
| `vars` | Plaintext vars | STABLE | STABLE | STABLE | STABLE | STABLE | HTTP effects via `/bindings/vars` |
| `kv` | KV namespaces | STABLE | STABLE | STABLE | STABLE | STABLE | HTTP-observable get/put |
| `d1` | D1 databases | STABLE | STABLE | STABLE | STABLE | STABLE | HTTP-observable SELECT |
| `r2` | R2 buckets | STABLE | STABLE | STABLE | STABLE | STABLE | HTTP-observable object I/O |
| `durable-objects` | Durable Objects | STABLE | STABLE | STABLE | STABLE | STABLE | HTTP-observable DO fetch |
| `queues` | Queues | STABLE | STABLE | STABLE | STABLE | STABLE | Enqueue + KV marker parity |
| `service-bindings` | Service bindings | STABLE | STABLE | STABLE | STABLE | STABLE | Worker Entrypoint over service binding |
| `workflows` | Workflows | STABLE | STABLE | STABLE | STABLE | STABLE | Deterministic workflow probe |
| `hyperdrive` | Hyperdrive | STABLE | STABLE | STABLE | STABLE | STABLE | Configured or deterministic fixture |
| `vectorize` | Vectorize | STABLE | STABLE | STABLE | STABLE | STABLE | Configured or deterministic fixture |
| `workers-ai` | Workers AI | STABLE | STABLE | STABLE | STABLE | STABLE | Structure + marker; text normalized |
| `websockets` | WebSockets | STABLE | STABLE | STABLE | STABLE | STABLE | Upgrade + lifecycle capture |
| `cron-triggers` | Cron Triggers | STABLE | STABLE | STABLE | STABLE | STABLE | `scheduled()` + HTTP mirror |

Fixture corpus: [`fixtures/bindings-http`](../fixtures/bindings-http). Full notes: JSON report `bindings[].notes`.

## Vitest / Vite

- Zero-config may detect Vitest / `@cloudflare/vitest-pool-workers` signals
- `edgemirror verify --vitest` runs the project’s test script when detected
- `@edgemirror/vitest` is a thin reporter only — not a Cloudflare pool replacement

## Compatibility dates

```bash
edgemirror compat --dates 2024-11-11,2025-04-01
```

After Agent 2 merge, `edgemirror matrix` is an alias. Cells are written only after **real local** executions — never fabricated.

## Commands related to Cloudflare

| Command | Purpose | Credentials |
|---------|---------|-------------|
| `edgemirror doctor` | Fingerprint Wrangler/workerd/auth/bindings | No |
| `edgemirror doctor --support-report` | Machine-readable support JSON | No |
| `edgemirror doctor --bindings` | Human bindings matrix (all STABLE) | No |
| `edgemirror verify --local` | Local-only parity | No |
| `edgemirror verify` / `preview` | Local vs remote/preview | Yes for remote |
| `edgemirror compat` / `matrix` | Real local compatibility-date matrix | No |
| `edgemirror pitch-demo` / `demo cloudflare` | Live meeting demo | Optional for preview |
| `edgemirror demo reset` | Ownership-safe Cloudflare cleanup | Yes |

Bindings fixture (all surfaces): `fixtures/bindings-http` — `edgemirror verify --local --filter bindings`.

## Honesty invariants (from report)

- Missing credentials → `REMOTE_NOT_CONFIGURED`
- Compat/matrix cells only after real local executions
- Infrastructure failures are never classified as `RUNTIME_DIVERGENCE`
- DEMO / pitch findings are labeled and isolated from real corpora
- Support levels ≠ Cloudflare product GA status

## Dogfood

EdgeMirror orchestrates Wrangler / workerd / temporary `workers.dev` Workers. It does not replace Cloudflare tooling.

## Further reading

- [site/cloudflare/](./site/cloudflare/)
- [ADAPTER_SPEC.md](./ADAPTER_SPEC.md)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
