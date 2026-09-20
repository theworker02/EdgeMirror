# Agent 3 — Final Security Report (for Agent 6)

Branch: `agent/security`  
Date: 2026-09-19  
**No SOC 2 / ISO / certification claims.**

## Critical

_None open after this branch._

| ID | Finding | Status |
|----|---------|--------|
| C1 | SSRF via `new URL(absolutePath, base)` on corpus/request paths | **Fixed** — `resolveWorkerRequestUrl` / `sanitizeRequestPath` |
| C2 | Preview `--url` could target internal/metadata hosts | **Fixed** — `assertAllowedPreviewUrl` allowlist + private IP block |
| C3 | Ownership cleanup trusted any JSON with `edgemirrorOwned: true` (confused deputy → delete foreign Workers) | **Fixed** — require `edgemirror-tmp-*` (+ optional HMAC) |

## High

| ID | Finding | Status |
|----|---------|--------|
| H1 | Windows `spawn(..., { shell: true })` with user-influenced argv (DEP0190 concat) | **Fixed** — prefer `node <wrangler-bin>`; shell only last resort |
| H2 | Corpus paths could traverse outside project root | **Fixed** — `resolveContained` |
| H3 | Composite Action interpolated `${{ inputs.* }}` into bash | **Fixed** — env + format allowlist |
| H4 | Future billing: unsigned `{ plan: "enterprise" }` forgery | **Mitigated (library)** — signed `em1.` entitlements; adversarial tests |
| H5 | Future cross-tenant IDOR | **Mitigated (library)** — RBAC `assertSameTenant` fail-closed |

## Medium

| ID | Finding | Status |
|----|---------|--------|
| M1 | Unbounded remote budgets via config | **Fixed** — zod max + `HARD_MAX_REMOTE_*` clamp |
| M2 | Unbounded HTTP body capture (DoS / disk) | **Fixed** — 2 MiB truncate; 512 KiB request body cap |
| M3 | Secret leakage in traces (runner/stripe/GH PAT) | **Fixed** — expanded redaction patterns |
| M4 | Webhook spoofing (future control-plane) | **Mitigated (library)** — Stripe/GitHub HMAC validators |
| M5 | Fork PR secret exposure (operational) | **Documented + helper** — `assertCiSecretsPolicy`; scaffold comments |

## Fixed (summary)

- `packages/cli/src/security/**` primitives
- Execution targets (local/remote/preview) use URL + limit + spawn guards
- Ownership claim/cleanup hardened
- `docs/THREAT_MODEL.md`, `docs/SECURITY.md`
- `scripts/sbom-generate.mjs`, `scripts/dependency-audit.mjs`
- `docs/security/sbom.json`, `docs/security/dependency-audit.json`
- Adversarial tests: 20 passing; full CLI: 44 passing

## Limitations

1. **No hosted multi-tenant API yet** — RBAC/webhooks/entitlements/runner auth are libraries + tests, not production wire-up.
2. **Local trust** — a compromised workstation can still read tokens from the environment; out of scope.
3. **Wrangler trust** — CLI still executes project Wrangler/config; malicious Worker code is the user’s trust domain.
4. **Optional ownership MAC** — without `EDGEMIRROR_OWNERSHIP_SECRET`, name-prefix checks still apply; MAC is defense-in-depth.
5. **npm audit** — production omit=dev currently clean (0 high/critical at report time); re-run before release.
6. **Windows last-resort npx.cmd + shell** — only if wrangler cannot be resolved as a node entry; install/pin wrangler to avoid.

## Release blockers (Agent 6)

| Blocker | Severity | Action |
|---------|----------|--------|
| None from Agent 3 for CLI local/verify path | — | Ship CLI security hardenings with Phase 3/4 CLI release |
| Do **not** enable hosted billing/runners without wiring entitlement + RBAC + webhook modules | High (if SaaS ships) | Gate SaaS launch on integrating `security/*` primitives |
| Re-run `npm run security:audit` / `security:sbom` on release commit | Medium | Include artifacts or CI step |
| Ensure fork PRs never receive `CLOUDFLARE_*` / runner secrets | High (CI config) | Org Actions secret policy — ops, not code |

## Cite-able facts (Agent 4)

- Temporary Workers are prefixed `edgemirror-tmp-` and tracked under `.edgemirror/ownership/`.
- Missing Cloudflare credentials → honest `REMOTE_NOT_CONFIGURED` (no fabricated parity).
- Request paths cannot SSRF off the execution origin; preview URLs must be `*.workers.dev` (or configured suffix).
- Evidence is redacted before persistence; treat artifacts as sensitive anyway.
- Supply-chain: `npm run security:sbom` and `npm run security:audit` (informational; not a certification).
