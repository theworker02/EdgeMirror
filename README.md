# EdgeMirror

**Production parity testing for Cloudflare Workers** — does this app behave the same locally as on the real Cloudflare platform?

EdgeMirror is an independent open-source project and is **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.**

## Status

| Capability | Status |
|------------|--------|
| `edgemirror doctor` / discovery | Works |
| Local execution (`wrangler dev --local`) | Works |
| Remote / preview differential | Requires Cloudflare credentials — reports `REMOTE_NOT_CONFIGURED` when absent (never faked) |
| Normalize → diff → evidence receipts | Works |
| `edgemirror verify` / `v` | Works (zero-config where possible) |
| `edgemirror compat` | Local matrix works; remote matrix needs credentials |
| `edgemirror bundle EM-###` | Works |
| GitHub Action scaffold | Works via `edgemirror init --github` |
| Vitest adapter (`@edgemirror/vitest`) | Thin reporter — does not replace Vitest |

## Quick start

```bash
npm install
npm run build
npm test

# From a Worker project (or fixtures/basic-worker):
npx edgemirror init
npx edgemirror doctor
npx edgemirror verify --local
npx edgemirror test --local --filter http-get-root
```

With Cloudflare credentials (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`):

```bash
npx edgemirror verify
npx edgemirror preview
npx edgemirror test --ci
```

## Commands

| Command | Alias | Purpose |
|---------|-------|---------|
| `init` | | Write `edgemirror.yaml` + `.edgemirror/`; `--github` adds workflow |
| `doctor` | | Environment / Wrangler fingerprint |
| `verify` | `v` | High-level checks; honest skips when remote unavailable |
| `test` | | Local ↔ remote (or preview) differential corpus |
| `preview` | | Local ↔ preview URL differential |
| `compat` | | Compatibility-date local matrix |
| `bundle <id>` | | Portable evidence under `.edgemirror/bundles/` |
| `deploy` | | `verify` then `wrangler deploy` (never replaces Wrangler) |

Agent-friendly output: `edgemirror verify --format agent`

## Evidence

Runs write artifacts to `.edgemirror/runs/<id>/` (traces, receipts, reports).  
`edgemirror bundle EM-001` packages a finding for sharing.

## Exit codes (`--ci`)

| Code | Meaning |
|------|---------|
| 0 | Parity established (or intentional local-only success) |
| 1 | Confirmed unexpected divergence |
| 2 | Configuration / execution failure |
| 3 | Insufficient evidence (e.g. remote attempted but not configured) |

## License

Apache-2.0 — see [LICENSE](./LICENSE).
