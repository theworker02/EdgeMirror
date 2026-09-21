# EdgeMirror — Project-Specific Diligence

**Date:** 2026-09-21

## Edge provider dependencies

- Primary integration: **Cloudflare Workers** via **Wrangler / workerd** (npm deps; not vendored Cloudflare source).
- Auth: `CLOUDFLARE_API_TOKEN` or API key+email / Wrangler OAuth (buyer’s account).

## Cloudflare-specific interfaces

- Adapters under `packages/cli/src/adapters/cloudflare/`.
- Bindings matrix documented in `docs/CLOUDFLARE_INTEGRATION.md` (KV, D1, R2, DO, queues, etc.).
- CI: `integrations/github-actions/`.

## Compatibility boundaries

- Local workerd vs remote Workers parity is the product thesis; live remote checks need credentials.
- EdgeMirror `ExecutionContext` type is internal — not the Workers runtime type.

## Local/production parity claims

- Product claims “STABLE” bindings coverage — verify against docs and fixtures; do not read as Cloudflare endorsement.

## Benchmarking methodology

- Supercharger microbenches labeled **MEASURED** in `docs/BENCHMARKS.md` / `benchmarks/*.json`.
- Explicitly **not** a claim about wrangler/verify wall-clock speedup for all workloads.
- Do not fabricate additional numbers beyond committed artifacts.

## Proprietary differentiators (asserted product features)

- Parity doctor/verify gates, Supercharger scheduler, bindings support report, optional billing packages.
- Independence from Cloudflare corporate affiliation (disclaimed in LICENSE/NOTICE).

## Third-party SDK obligations

- Wrangler/workerd licenses (MIT OR Apache-2.0 / Apache-2.0) must be preserved.
- Stripe SDK if billing features used (MIT).
- Cloudflare trademark rules apply to marketing — **REQUIRES_LEGAL_REVIEW**.
