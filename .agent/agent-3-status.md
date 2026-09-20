# Agent 3 — Security / Hardening — Status

Branch/worktree: `agent/security` @ `C:\Users\matth\OneDrive\Desktop\EdgeMirror-security`  
Updated: 2026-09-19

## Done

- [x] Threat model refresh (`docs/THREAT_MODEL.md`)
- [x] SECURITY facts for Agent 4 (`docs/SECURITY.md`) — no certification claims
- [x] Security primitives package (`packages/cli/src/security/*`)
  - SSRF / request-path / preview allowlist
  - Path containment
  - Argv-safe wrangler spawn (prefer `node` entry)
  - Resource limits + budget hard ceilings
  - Webhook HMAC (GitHub + Stripe)
  - RBAC + cross-tenant deny
  - Entitlement forgery resistance
  - Runner auth assumptions + fork-PR secret policy helper
  - Ownership MAC / `edgemirror-tmp-*` guard
- [x] Wired into local/remote/preview execution, corpus, config, ownership, deploy, privacy
- [x] Composite Action env-based input hardening
- [x] Adversarial suite (`tests/adversarial-security.test.ts`) — 20 tests
- [x] SBOM + dependency audit scripts → `docs/security/`
- [x] Full CLI suite green (44 tests)

## In progress / next for Agent 6

- Consume `.agent/agent-3-final.md` for release blockers
- Optional: wire `npm run security:audit` into CI (not owned by Agent 3)

## Notes

- Hosted control-plane / Stripe billing / multi-tenant API not shipped; library primitives + tests only
- `EDGEMIRROR_OWNERSHIP_SECRET` optional; recommended when CI writes ownership markers on shared disks
