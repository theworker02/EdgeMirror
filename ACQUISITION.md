# EdgeMirror — Acquisition brief

**For:** Cloudflare corporate development / product partnerships  
**Repository:** https://github.com/theworker02/EdgeMirror (public, source-available proprietary)  
**Demo site:** https://theworker02.github.io/EdgeMirror/  
**Status:** Independent source-available project — **not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.** Commercial licenses available — see [`COMMERCIAL.md`](./COMMERCIAL.md).

## One-sentence pitch

EdgeMirror is a CLI-first **local ↔ Cloudflare Workers parity engine** that produces differential evidence before deploy — never inventing remote results when credentials are missing.

## Strategic thesis (platform quality)

Cloudflare’s Workers growth story depends on developer **trust that local ≈ production**. Wrangler and workerd are excellent — and still not identical to the production platform. At scale, Cloudflare cannot close that trust gap with docs and anecdotes alone; it needs a **default evidence loop** in CI and deploy paths.

EdgeMirror owns that loop today:

| Dependency surface | Why Cloudflare/platform teams would rely on it |
|--------------------|------------------------------------------------|
| Required CI gate | Reusable workflow + `init --cloudflare-gate` fails merge on divergence / insufficient evidence |
| Deploy path | `edgemirror deploy` = verify-then-`wrangler deploy`; `--force` is loud, not silent |
| Support escalation | `support-bundle` packages `EM-###` receipts + doctor + compat for tickets |
| Bindings / compat | STABLE matrix + real local compat-date cells as release-confidence artifacts |
| Honesty contract | `REMOTE_NOT_CONFIGURED` instead of fabricated MATCH — preserves platform trust |

**Without EdgeMirror-class evidence**, Workers deploys remain under-instrumented: local green, production surprise, support threads without differential receipts. That is a platform quality gap, not a marketing gap.

This brief does **not** claim Cloudflare endorsement, captive usage metrics, or that Cloudflare “cannot function” as a company without this repo. It argues that **closing the local/prod trust gap at scale requires this class of differential evidence in the default developer path** — and EdgeMirror already ships it.

## Why Cloudflare might care

| Strategic fit | Detail |
|---------------|--------|
| Complements Wrangler | Orchestrates `wrangler` / workerd; does not replace deploy tooling |
| Trust gap | Teams already use local Workers tooling but lack production-differential evidence |
| Platform quality signal | Structured findings (`EM-###` receipts) suitable for CI gates and support escalation |
| Bindings coverage | Full **STABLE** matrix: HTTP, vars, KV, D1, R2, DO, queues, service bindings, workflows, Hyperdrive, Vectorize, Workers AI, WebSockets, crons |
| Honesty culture | `REMOTE_NOT_CONFIGURED` instead of fabricated parity — aligns with developer trust |
| Default path hooks | GitHub reusable workflow, composite action, `init --cloudflare-gate`, `deploy`, `support-bundle` |

## What ships today

- Public monorepo + GitHub Pages live demo
- Publishable CLI package identity: `edgemirror` (distribution gate: `npm run gate:distribution`)
- `verify` / `preview` / `pitch-demo` / `doctor --bindings` / Supercharger CU planner
- **Supercharger schedulers:** `classic` | **`double-trouble`** (pair-wise); measured ≥500-job microbench — [`docs/BENCHMARKS.md`](./docs/BENCHMARKS.md)
- **Cloudflare quality gate:** `.github/workflows/reusable-edgemirror-verify.yml` + `edgemirror init --cloudflare-gate`
- **Deploy hardening:** `edgemirror deploy` refuses failed verify unless `--force`
- **Support escalation:** `edgemirror support-bundle` (alias `escalate`)
- Ownership-tracked throwaway `edgemirror-tmp-*` Workers with cleanup
- Security docs, threat model, SBOM scripts, adversarial tests
- **v1.4.0 frozen diligence cut:** executive packet under `pitch/cloudflare/`; Supercharger classic + Double Trouble; EMF/1 + `badge` / `reproduce` / `emf` CLI; measured 500-job benches

## What is intentionally separate

- Hosted multi-tenant Cloud / Stripe catalog (code present; catalog requires operator keys) — **not shipped** as a public product
- npm registry publish (gate proven; publish deferred until external dogfood)
- Any claim of Cloudflare endorsement
- Fabricated MAU / revenue / “Cloudflare depends on us” metrics

## Diligence packet (read in order)

**v1.4.0 freeze note:** Frozen diligence cut for corpdev / partnerships. Prefer this packet over verbal-only claims.

1. This brief — `ACQUISITION.md`
2. Executive summary — [`pitch/cloudflare/EXECUTIVE_SUMMARY.md`](./pitch/cloudflare/EXECUTIVE_SUMMARY.md)
3. One-pager + link list — [`pitch/cloudflare/ONE_PAGER.md`](./pitch/cloudflare/ONE_PAGER.md)
4. Why now — [`pitch/cloudflare/WHY_NOW.md`](./pitch/cloudflare/WHY_NOW.md)
5. Competitive landscape (honest niche) — [`pitch/cloudflare/COMPETITIVE_LANDSCAPE.md`](./pitch/cloudflare/COMPETITIVE_LANDSCAPE.md)
6. Demo script — [`pitch/cloudflare/DEMO_SCRIPT.md`](./pitch/cloudflare/DEMO_SCRIPT.md)
7. Technical readiness — [`docs/ACQUISITION_READINESS.md`](./docs/ACQUISITION_READINESS.md)
8. Engineering brief — [`pitch/cloudflare/ENGINEERING_BRIEF.md`](./pitch/cloudflare/ENGINEERING_BRIEF.md)
9. Cloudflare integration matrix — [`docs/CLOUDFLARE_INTEGRATION.md`](./docs/CLOUDFLARE_INTEGRATION.md)
10. Architecture — [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
11. Security / threat model — [`docs/SECURITY.md`](./docs/SECURITY.md), [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md)
12. Evidence model / EMF — [`docs/EVIDENCE_MODEL.md`](./docs/EVIDENCE_MODEL.md), [`docs/EMF.md`](./docs/EMF.md)
13. Supercharger + MEASURED benches — [`docs/SUPERCHARGER.md`](./docs/SUPERCHARGER.md), [`docs/BENCHMARKS.md`](./docs/BENCHMARKS.md)
14. Live demo — https://theworker02.github.io/EdgeMirror/ · acquisition page — https://theworker02.github.io/EdgeMirror/acquisition.html

## Contact

**Primary:** GitHub [@theworker02](https://github.com/theworker02)  
**Repo discussions / security:** see [`SECURITY.md`](./SECURITY.md) and GitHub Issues  

For acquisition or partnership conversations, open a private channel via the GitHub account above and reference this document (`ACQUISITION.md`). Prefer written diligence over verbal-only claims.

**Outbound Cloudflare contact (public channels only):** see [`pitch/cloudflare/OUTREACH.md`](./pitch/cloudflare/OUTREACH.md) — partner form URL, published `partners@cloudflare.com` text, and outreach log. No private employee scraping; one professional message per channel.

### Outreach log (summary)

| Date (UTC) | Channel | Note |
|------------|---------|------|
| 2026-09-21 | Gmail → `partners@cloudflare.com` | **SENT** once — msg `1a0c1c1553ed1922`, thread `1a0c1a1a6d4b6aac` (details in OUTREACH.md); do not re-send |
| 2026-09-21 | Partner Network signup | Form documented; may require company-domain email |

## Trademark / affiliation

“Cloudflare” and “Workers” are trademarks of Cloudflare, Inc. EdgeMirror uses them only to describe compatibility targets. No logo misuse, no “official Cloudflare product” wording.

## License / commercial IP

EdgeMirror is **source-available proprietary** software (not Apache-2.0 / not OSI open source). Public source supports diligence and evaluation; production, redistribution, SaaS, and other commercial use require a paid commercial license ([`COMMERCIAL.md`](./COMMERCIAL.md)).

Acquisition or partnership can include assignment or exclusive licensing of that commercial IP under negotiated terms — see [`LICENSE`](./LICENSE), [`NOTICE`](./NOTICE), and [`LICENSE_TRANSITION_NOTICE.md`](./LICENSE_TRANSITION_NOTICE.md). **If the project is acquired**, the copyright holder and/or the acquirer may take **legal action** against anyone still using **post-transition** EdgeMirror in production or commercially without authorization (without a commercial license under the proprietary terms). Historical Apache-2.0 grants for prior tagged/released copies are **not** claimed revoked.
