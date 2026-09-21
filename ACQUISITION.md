# EdgeMirror — Acquisition brief

**For:** Cloudflare corporate development / product partnerships  
**Repository:** https://github.com/theworker02/EdgeMirror (public, Apache-2.0)  
**Demo site:** https://theworker02.github.io/EdgeMirror/  
**Status:** Independent open-source project — **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.**

## One-sentence pitch

EdgeMirror is a CLI-first **local ↔ Cloudflare Workers parity engine** that produces differential evidence before deploy — never inventing remote results when credentials are missing.

## Why Cloudflare might care

| Strategic fit | Detail |
|---------------|--------|
| Complements Wrangler | Orchestrates `wrangler` / workerd; does not replace deploy tooling |
| Trust gap | Teams already use local Workers tooling but lack production-differential evidence |
| Platform quality signal | Structured findings (`EM-###` receipts) suitable for CI gates and support escalation |
| Bindings coverage | Full **STABLE** matrix: HTTP, vars, KV, D1, R2, DO, queues, service bindings, workflows, Hyperdrive, Vectorize, Workers AI, WebSockets, crons |
| Honesty culture | `REMOTE_NOT_CONFIGURED` instead of fabricated parity — aligns with developer trust |

## What ships today

- Public monorepo + GitHub Pages live demo
- Publishable CLI package identity: `edgemirror` (distribution gate: `npm run gate:distribution`)
- `verify` / `preview` / `pitch-demo` / `doctor --bindings` / Supercharger CU planner
- Ownership-tracked throwaway `edgemirror-tmp-*` Workers with cleanup
- Security docs, threat model, SBOM scripts, adversarial tests

## What is intentionally separate

- Hosted multi-tenant Cloud / Stripe catalog (code present; catalog requires operator keys)
- npm registry publish (gate proven; publish deferred until external dogfood)
- Any claim of Cloudflare endorsement

## Diligence packet (read in order)

1. This brief — `ACQUISITION.md`
2. Technical readiness — [`docs/ACQUISITION_READINESS.md`](./docs/ACQUISITION_READINESS.md)
3. Engineering brief — [`pitch/cloudflare/ENGINEERING_BRIEF.md`](./pitch/cloudflare/ENGINEERING_BRIEF.md)
4. Cloudflare integration matrix — [`docs/CLOUDFLARE_INTEGRATION.md`](./docs/CLOUDFLARE_INTEGRATION.md)
5. Architecture — [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
6. Security / threat model — [`docs/SECURITY.md`](./docs/SECURITY.md), [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md)
7. Evidence model — [`docs/EVIDENCE_MODEL.md`](./docs/EVIDENCE_MODEL.md)
8. Live demo — https://theworker02.github.io/EdgeMirror/

## Contact

**Primary:** GitHub [@theworker02](https://github.com/theworker02)  
**Repo discussions / security:** see [`SECURITY.md`](./SECURITY.md) and GitHub Issues  

For acquisition or partnership conversations, open a private channel via the GitHub account above and reference this document (`ACQUISITION.md`). Prefer written diligence over verbal-only claims.

## Trademark / affiliation

“Cloudflare” and “Workers” are trademarks of Cloudflare, Inc. EdgeMirror uses them only to describe compatibility targets. No logo misuse, no “official Cloudflare product” wording.

## License

Apache License 2.0 — see [`LICENSE`](./LICENSE).
