# EdgeMirror — Engineering Brief (Cloudflare)

**Audience:** Cloudflare engineers evaluating EdgeMirror as independent Workers tooling.  
**Not an acquisition ask.** EdgeMirror is not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.

## Problem

Local Workers tooling (`wrangler` / workerd) is excellent and still not identical to the production platform. Teams lack differential **evidence** before merge and deploy.

## Solution

EdgeMirror runs the same parity corpus against local and remote/preview targets, normalizes nondeterminism, classifies differences, and emits hashed evidence receipts (`EM-###`). Missing credentials yield `REMOTE_NOT_CONFIGURED` — never fabricated remote traces.

## Architecture (summary)

CLI-first engine in `@edgemirror/cli`: discovery → execution targets → traces → normalize/diff → provenance → ownership-tracked cleanup. Optional future Supercharger and hosted Cloud do not gate OSS verify.

Details: `docs/ARCHITECTURE.md`.

## Cloudflare integrations

Orchestrates Wrangler for:

- `wrangler dev --local` (workerd)
- Temporary `edgemirror-tmp-*` Workers on workers.dev
- `wrangler versions upload` preview URLs when credentials exist

Auth: API token (preferred), API key+email, or Wrangler OAuth. See Agent 2 support report.

## Runtime coverage (EdgeMirror capability)

Source: `.agent/cloudflare-support-report.json` (Agent 2, `agent/cloudflare`).

- **STABLE parity:** HTTP fetch handler (status/headers/body)
- **BETA / EXPERIMENTAL / UNSUPPORTED:** KV, D1, R2, DO, queues, workflows, AI, WebSockets, crons — as tabulated in `docs/CLOUDFLARE_INTEGRATION.md`
- Support levels describe EdgeMirror instrumentation depth, **not** Cloudflare product GA

## Corpus

Built-in HTTP fixture (`http-get-root`) plus project corpus paths. DEMO / pitch paths are labeled and isolated.

## Supercharger

Optional performance layer (IN DEVELOPMENT). **Compute Units are accounting meters — not cryptocurrency.** OSS verify works without Supercharger.

## Security

Ownership-marked temporary resources; redaction before persistence; budgets for remote runs. See `docs/SECURITY.md` and `docs/THREAT_MODEL.md`. Agent 3 owns adversarial hardening.

## Adoption metrics

No public adoption, revenue, or customer counts are claimed here. Measure installations and verdicable verify runs when instrumentation exists.

## Real findings

Do not cite fabricated divergences. Use `edgemirror demo` / post-merge `pitch-demo` for labeled demonstrations, and real project receipts for diligence.

## Integration opportunities (technical, non-exclusive)

- CI gates beside Wrangler deploy
- Compatibility-date matrices in PR checks
- Evidence bundles attached to incidents / upstream issues (manual)
- Future deeper binding instrumentation coordinated with Wrangler/workerd observability

Wrangler remains the deployment tool of record (`edgemirror deploy` only orchestrates verify → deploy).
