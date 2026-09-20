# Acquisition Readiness (technical diligence)

This document is for technical diligence only — not a business plan.

## Product clarity

- **Problem:** Local Cloudflare Workers behavior can diverge from production; teams lack differential evidence.
- **Approach:** CLI engine executes the same corpus locally and remotely, normalizes nondeterminism, classifies differences, emits evidence receipts.
- **Non-goals (current):** Hosted SaaS dashboard, multi-cloud production support, automatic upstream issue filing.

## Engineering maturity signals

| Area | Signal |
|------|--------|
| Schema stability | Versioned `ExecutionTrace` / receipts (`1.0`) |
| Honesty under missing infra | `REMOTE_NOT_CONFIGURED` instead of fake parity |
| Safety | Ownership-tracked cleanup; remote budgets |
| Testability | Unit + fixture integration + absent-credential tests |
| Extensibility | Adapter interfaces; Vitest reporter package |
| CI | GitHub workflow scaffold + composite action |

## Dependencies / concentration risk

- Depends on Wrangler / workerd CLI behavior
- Cloudflare API availability and token scopes
- Node ≥ 20

## Gaps before broader adoption

- Broader binding instrumentation (DO/Queue/D1 deep traces)
- Credentialed CI demo project
- Package publishing pipeline (unscoped `edgemirror` on npmjs.com; see `docs/DISTRIBUTION.md` and `npm run gate:distribution`)
- Compatibility matrix expansion and version-skew workflows
