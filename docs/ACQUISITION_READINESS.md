# Acquisition readiness (technical diligence)

Technical diligence packet for evaluators. Not a valuation or term sheet.

## Product clarity

| Item | Fact |
|------|------|
| Problem | Local Cloudflare Workers behavior can diverge from production; teams lack differential **evidence** |
| Approach | Same corpus on local workerd and remote/preview; normalize; diff; classify; emit `EM-###` receipts |
| Primary artifact | CLI `edgemirror` (unscoped package name; source-available proprietary) |
| Honesty rule | Missing credentials → `REMOTE_NOT_CONFIGURED` — never fabricated remote traces |
| Non-goals (current public tree) | Replacing Wrangler deploy; multi-cloud production; automatic upstream bug filing |

## Engineering maturity

| Area | Signal |
|------|--------|
| Public repo | https://github.com/theworker02/EdgeMirror |
| Demo | https://theworker02.github.io/EdgeMirror/ |
| Schema | Versioned `ExecutionTrace` / receipts |
| Bindings matrix | All listed surfaces **STABLE** — `edgemirror doctor --bindings` |
| Safety | Ownership-tracked `edgemirror-tmp-*` cleanup; remote budgets; SSRF/path/spawn hardening |
| Tests | Unit + fixture integration + absent-credential honesty tests + bindings-http suite |
| Distribution | `npm run gate:distribution` (pack → blank Worker → doctor/verify) |
| CI | GitHub Actions Pages deploy; local `npm run ci:local` gate script |

## Dependency / concentration risk

- Wrangler / workerd CLI behavior and Cloudflare API availability
- Node.js ≥ 20
- Optional Stripe keys only for hosted Cloud catalog (not required for CLI verify)

## Open items (honest)

| Item | Status |
|------|--------|
| npmjs.com publish of `edgemirror` | Gate proven; publish after external dogfood |
| Stripe test catalog + Checkout | Scripted; needs operator `sk_test_` |
| Broad external dogfood (5–10 repos) | Harness present (`npm run dogfood`); quiet asks next |
| Deep non-HTTP instrumentation | HTTP/WS-observable parity is STABLE; raw binding dumps not claimed |

## Suggested diligence demo (≤ 15 minutes)

```bash
git clone https://github.com/theworker02/EdgeMirror.git
cd EdgeMirror && npm install && npm run build
cd fixtures/bindings-http
node ../../packages/cli/dist/cli/bin.js doctor --bindings
node ../../packages/cli/dist/cli/bin.js verify --local --filter bindings
# optional with wrangler login:
node ../../packages/cli/dist/cli/bin.js pitch-demo
```

## Related docs

- [`ACQUISITION.md`](../ACQUISITION.md) — forward-facing brief  
- [`pitch/cloudflare/ENGINEERING_BRIEF.md`](../pitch/cloudflare/ENGINEERING_BRIEF.md)  
- [`docs/CLOUDFLARE_INTEGRATION.md`](./CLOUDFLARE_INTEGRATION.md)  
- [`docs/SECURITY.md`](./SECURITY.md)
