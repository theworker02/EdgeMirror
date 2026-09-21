# Competitive landscape — honest niche

**Purpose:** Diligence positioning without fake competitor teardown or invented market share.  
**Rule:** Describe adjacent approaches and EdgeMirror’s differential-evidence niche. No fabricated “we beat X by N%.”

## Adjacent approaches (what teams actually do)

| Approach | Strength | Gap relative to EdgeMirror |
|----------|----------|----------------------------|
| **Wrangler alone** (`wrangler dev`, deploy, versions) | Canonical Workers toolchain; best local DX | No structured local↔remote differential corpus, classification, or `EM-###` evidence receipts as a merge/deploy gate |
| **Custom CI scripts** (curl fixtures, ad-hoc smoke against preview) | Cheap to start; team-owned | Rarely normalizes nondeterminism, rarely ownership-tracks throwaway Workers, rarely packages support-ready evidence; drifts per repo |
| **General e2e / browser suites** (Playwright, Cypress, etc.) | Strong UX / HTTP path coverage | Not Workers-binding-aware parity engines; do not own workerd↔platform classification or `REMOTE_NOT_CONFIGURED` honesty contracts |
| **Vitest + Cloudflare pool** | Excellent unit/integration against workerd | Complements EdgeMirror; does not replace differential remote evidence. EdgeMirror’s `@edgemirror/vitest` reporter correlates — it does not replace the CF pool |

## EdgeMirror’s niche

**Differential evidence for Cloudflare Workers** — same parity corpus against local and remote/preview, normalize → diff → classify → hashed receipts, wired into CI and deploy:

- Fail merge / refuse deploy on divergence or insufficient evidence
- Honest missing-credential behavior (`REMOTE_NOT_CONFIGURED`)
- Support escalation packets (`support-bundle`)
- Optional Supercharger acceleration (classic | double-trouble) without changing evidence semantics

That niche is **narrow and intentional**. EdgeMirror does not claim to be a general testing platform, a Wrangler replacement, or a hosted observability suite.

## What we do **not** claim

- No “only solution” or monopoly language
- No invented competitor revenue, headcount, or feature scores
- No Cloudflare endorsement implied by adjacency to Wrangler
- No OSS/Apache positioning — source-available proprietary
- No Hosted Cloud as shipped competition against Cloudflare dashboards

## Buy-vs-build note

Cloudflare already owns Wrangler and the platform. The open question is whether a first-party or acquired **evidence layer** should sit beside deploy tooling. EdgeMirror is the shipped instance of that layer — diligence should compare **capability and honesty contracts**, not marketing scorecards.

## Related

- [`WHY_NOW.md`](./WHY_NOW.md) — timing  
- [`EXECUTIVE_SUMMARY.md`](./EXECUTIVE_SUMMARY.md) — board brief  
- [`ENGINEERING_BRIEF.md`](./ENGINEERING_BRIEF.md) — technical surface  
- [`docs/CLOUDFLARE_INTEGRATION.md`](../../docs/CLOUDFLARE_INTEGRATION.md) — integration matrix
