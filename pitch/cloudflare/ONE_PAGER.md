# EdgeMirror — One-pager (Cloudflare diligence)

**Independent · source-available proprietary · not affiliated with Cloudflare, Inc.**  
**Freeze:** v1.4.0

## Pitch (30 seconds)

Local workerd ≠ production Workers. EdgeMirror is the **differential evidence layer** before merge and deploy: same corpus, local + remote/preview, normalized diffs, `EM-###` receipts. Missing auth → `REMOTE_NOT_CONFIGURED`, never fake MATCH.

## Why it matters

- Closes the **Workers trust gap** with CI/deploy gates, not slides
- Complements **Wrangler** — orchestrates it; does not replace deploy
- Packages **support-ready** evidence for tickets
- Optional **Supercharger** (classic | **double-trouble**) for large job DAGs — CU is accounting only

## What to try in five minutes

1. `edgemirror pitch-demo` — labeled live divergence  
2. `edgemirror verify` — honest local/remote outcomes  
3. `edgemirror support-bundle` — escalation packet  
4. `edgemirror supercharge bench --jobs 500 --scheduler classic|double-trouble` — measured scheduler capacity  

Script: [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md)

## Diligence link list (read in order)

| # | Doc | Purpose |
|---|-----|---------|
| 1 | [`EXECUTIVE_SUMMARY.md`](./EXECUTIVE_SUMMARY.md) | Board-room one page |
| 2 | [`ACQUISITION.md`](../../ACQUISITION.md) | Acquisition / partnership brief |
| 3 | [`WHY_NOW.md`](./WHY_NOW.md) | Timing thesis |
| 4 | [`COMPETITIVE_LANDSCAPE.md`](./COMPETITIVE_LANDSCAPE.md) | Honest niche (no fake teardown) |
| 5 | [`ENGINEERING_BRIEF.md`](./ENGINEERING_BRIEF.md) | Technical diligence |
| 6 | [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) | Live 5-minute path |
| 7 | [`docs/ACQUISITION_READINESS.md`](../../docs/ACQUISITION_READINESS.md) | Readiness checklist |
| 8 | [`docs/CLOUDFLARE_INTEGRATION.md`](../../docs/CLOUDFLARE_INTEGRATION.md) | Wrangler / bindings matrix |
| 9 | [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) | System design |
| 10 | [`docs/SECURITY.md`](../../docs/SECURITY.md) · [`docs/THREAT_MODEL.md`](../../docs/THREAT_MODEL.md) | Security |
| 11 | [`docs/EVIDENCE_MODEL.md`](../../docs/EVIDENCE_MODEL.md) · [`docs/EMF.md`](../../docs/EMF.md) | Receipts / EMF/1 |
| 12 | [`docs/SUPERCHARGER.md`](../../docs/SUPERCHARGER.md) · [`docs/BENCHMARKS.md`](../../docs/BENCHMARKS.md) | Scheduler + MEASURED numbers |
| 13 | [`COMMERCIAL.md`](../../COMMERCIAL.md) · [`LICENSE`](../../LICENSE) | Commercial IP (not OSS) |
| 14 | Live demo | https://theworker02.github.io/EdgeMirror/ |
| 15 | Repo | https://github.com/theworker02/EdgeMirror |

## Contact

GitHub [@theworker02](https://github.com/theworker02) · reference `ACQUISITION.md`  
Partners outreach (SENT once — do not re-send): [`OUTREACH.md`](./OUTREACH.md)
