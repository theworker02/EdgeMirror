# Adapter Spec

Adapters isolate platform-specific behavior so future runtimes can plug in without rewriting the engine.

## Surfaces

| Adapter | Role | Phase 2 quality |
|---------|------|-----------------|
| `RuntimeAdapter` | prepare / execute / cleanup | Cloudflare local, remote, preview |
| `BindingAdapter` | summarize bindings | Cloudflare wrangler config summarizer (inline) |
| `ReporterAdapter` | render reports | terminal / json / html / agent |
| `TestRunnerAdapter` | detect & run Vitest etc. | Detection in zero-config; thin `@edgemirror/vitest` |

## Rules

1. Adapters must not invent observations — use `unavailable` / status codes.
2. Cloudflare is the only production-quality target until explicitly promoted.
3. Prefer extending `packages/cli` until a package split has a clear consumer.

See `packages/cli/src/adapters/types.ts`.
