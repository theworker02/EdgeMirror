# Transfer Manifest — EdgeMirror

**Date:** 2026-09-21

| Asset | Category | Notes |
|-------|----------|-------|
| repository | TRANSFERABLE | github.com/theworker02/EdgeMirror |
| source code (original) | TRANSFERABLE | Subject to historical Apache grants already given |
| copyright (asserted) | REQUIRES_LEGAL_REVIEW | Asserted by theworker02; AI co-authorship uncertainty |
| brand / EdgeMirror name | TRANSFERABLE_WITH_CONSENT | No trademark registration docs in repo — UNKNOWN registration status |
| logos | TRANSFERABLE | branding/assets claimed first-party |
| domains | UNKNOWN | Not inventoried in repo |
| npm package name edgemirror | TRANSFERABLE_WITH_CONSENT | npm ownership transfer requires npm account control |
| CI/CD GitHub Actions | TRANSFERABLE | With repository transfer |
| Cloudflare API accounts | NONTRANSFERABLE | Buyer must use own Cloudflare account; secrets not transferable as assets |
| Stripe account | TRANSFERABLE_WITH_CONSENT | If used; requires Stripe account transfer process |
| secrets / signing keys | NONTRANSFERABLE | Rotate; migration checklist only — never commit |
| documentation | TRANSFERABLE | Original docs; third-party quotes remain third-party |

## Credentials migration checklist (no secrets committed)

- [ ] Inventory GitHub secrets / Actions secrets
- [ ] Inventory cloud API tokens (Cloudflare, etc.)
- [ ] Inventory package registry tokens
- [ ] Inventory signing keys
- [ ] Rotate all of the above at closing — **ROTATE_IMMEDIATELY** if any exposure suspected
- [ ] Buyer creates replacement secrets in buyer-controlled accounts

**NEVER commit credentials.**
