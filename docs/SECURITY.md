# Security

EdgeMirror runs locally and may deploy **temporary, EdgeMirror-owned** Workers when remote/preview tests are enabled.

**No SOC 2 / ISO / certification claims.** Facts below are for operators and Agent 4 citation.

## Trust boundaries

- **Local machine** — reads project Wrangler config, spawns `wrangler` via argv-safe invocation, writes `.edgemirror/`.
- **Cloudflare API** — only when credentials are present; creates/deletes `edgemirror-tmp-*` Workers or preview versions.
- **CI** — least-privilege (`contents: read`); do not inject `CLOUDFLARE_*` or runner tokens into fork PRs.
- **Fetch surface** — Worker request paths cannot redirect off the execution origin; preview bases must be allowlisted hosts.

## Credentials & secrets

- Prefer `CLOUDFLARE_API_TOKEN` over global API keys.
- Never commit tokens. `.env` is gitignored.
- Traces/reports pass through redaction (`privacy/`) including CF tokens, GitHub PATs, Stripe keys, EdgeMirror runner/entitlement tokens.
- Optional `EDGEMIRROR_OWNERSHIP_SECRET` — HMAC ownership markers so forged `.edgemirror/ownership/*.json` cannot authorize deletes.

## Resource safety

- Ownership markers under `.edgemirror/ownership/`.
- Cleanup only deletes resources that pass name + marker (+ optional MAC) checks.
- Temporary Worker names: `edgemirror-tmp-<8 hex>`.
- Remote budgets clamped (default 200 runs / 15 minutes; hard max 1000 / 60).
- HTTP response capture truncated at 2 MiB.

## Command / path / SSRF hardening

| Control | Module |
|---------|--------|
| Request path SSRF | `packages/cli/src/security/url.ts` |
| Preview URL allowlist | `packages/cli/src/security/url.ts` |
| Corpus path containment | `packages/cli/src/security/paths.ts` |
| Argv-safe wrangler spawn | `packages/cli/src/security/spawn.ts` |
| Body / budget limits | `packages/cli/src/security/limits.ts` |

## Webhooks / RBAC / billing (library — Phase 4 ready)

| Control | Module |
|---------|--------|
| GitHub + Stripe HMAC validation | `security/webhooks.ts` |
| Roles + cross-tenant deny | `security/rbac.ts` |
| Signed entitlements (reject unsigned plan) | `security/entitlements.ts` |
| Runner bearer auth assumptions | `security/runner-auth.ts` |

## Supply chain

```bash
npm run security:sbom    # writes docs/security/sbom.json
npm run security:audit   # writes docs/security/dependency-audit.json
npm run test:security    # adversarial suite
```

Pin Wrangler in consumer projects when possible. CLI prefers local `node_modules/wrangler` entry over shell `npx`.

## Composite Action hardening

`integrations/github-actions/verify/action.yml` passes format/local-only via environment variables (not shell-interpolated expressions) and allowlists report formats.

## Reporting

Report security issues privately to the repository owner (`theworker02` on GitHub). Do not file public issues with exploit details.
