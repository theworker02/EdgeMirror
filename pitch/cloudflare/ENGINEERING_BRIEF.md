# EdgeMirror — Engineering Brief (Cloudflare)

**Audience:** Cloudflare engineers / technical diligence  
**Repo:** https://github.com/theworker02/EdgeMirror  
**Acquisition brief:** [`ACQUISITION.md`](../../ACQUISITION.md)  
EdgeMirror is **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.**

## Problem

Local Workers tooling (`wrangler` / workerd) is excellent and still not identical to the production platform. Teams lack differential **evidence** before merge and deploy.

## Solution

EdgeMirror runs the same parity corpus against local and remote/preview targets, normalizes nondeterminism, classifies differences, and emits hashed evidence receipts (`EM-###`). Missing credentials yield `REMOTE_NOT_CONFIGURED` — never fabricated remote traces.

## Architecture (summary)

CLI-first engine (`edgemirror`): discovery → execution targets → traces → normalize/diff → provenance → ownership-tracked cleanup. Optional Supercharger and hosted Cloud do not gate OSS verify.

Details: `docs/ARCHITECTURE.md`.

## Cloudflare integrations

Orchestrates Wrangler for:

- `wrangler dev --local` (workerd)
- Temporary `edgemirror-tmp-*` Workers on workers.dev
- Preview / versions upload when credentials exist (with first-deploy fallback)

Auth: API token (preferred), API key+email, or Wrangler OAuth.

## Runtime coverage (EdgeMirror capability)

Source: `edgemirror doctor --support-report` / `.agent/cloudflare-support-report.json`.

**All surfaces STABLE** (discovery, local, remote, preview, parity):

HTTP fetch · plaintext vars · KV · D1 · R2 · Durable Objects · queues · service bindings · workflows · Hyperdrive · Vectorize · Workers AI · WebSockets · cron triggers

Fixture: `fixtures/bindings-http`. Workers AI free-text is normalized; markers/structure compared.

## Corpus

Built-in HTTP corpus plus project corpus paths (e.g. bindings fixture). DEMO / pitch paths are labeled and isolated.

## Supercharger

Optional CU budget optimizer — selects different work packages by budget density. **Compute Units are accounting meters — not cryptocurrency.** OSS verify works without Supercharger.

## Security

Ownership-marked temporary resources; redaction before persistence; budgets for remote runs. See `docs/SECURITY.md` and `docs/THREAT_MODEL.md`.

## Adoption metrics

No fabricated MAU/revenue claims. Measure clones, verify runs, and distribution-gate survivals.

## Real findings

Do not cite fabricated divergences. Use `edgemirror pitch-demo` for labeled demonstrations, and real project receipts for diligence.

## Integration opportunities (technical, non-exclusive)

- CI gates beside Wrangler deploy
- Compatibility-date matrices in PR checks
- Support workflows that attach `EM-###` evidence bundles
- Potential first-party packaging under Cloudflare developer tooling (subject to acquisition / partnership)

## Links

- Live demo: https://theworker02.github.io/EdgeMirror/
- Acquisition brief: [`ACQUISITION.md`](../../ACQUISITION.md)
- Diligence: [`docs/ACQUISITION_READINESS.md`](../../docs/ACQUISITION_READINESS.md)
