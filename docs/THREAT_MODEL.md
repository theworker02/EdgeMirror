# Threat Model

Date: 2026-09-19  
Scope: EdgeMirror CLI (local + optional temporary remote Workers). Hosted control-plane is **out of production scope** but security **primitives** are landed for Phase 4.

**This document does not claim SOC 2, ISO 27001, or any certification.**

## Assets

| Asset | Sensitivity | Notes |
|-------|-------------|-------|
| Cloudflare API tokens / OAuth | Critical | Used only when remote/preview enabled |
| Customer Worker source + bindings | High | Read from project disk |
| Evidence artifacts (`.edgemirror/`) | High | May contain response bodies; redacted but still sensitive |
| Temporary cloud Workers | Medium | `edgemirror-tmp-*` only |
| Future: org data, billing entitlements, runner tokens | Critical | Library primitives only today |

## Trust boundaries / sandbox

```
[Developer workstation / CI runner]
        |  reads wrangler config, corpus (path-contained)
        |  spawns wrangler via argv-safe invocation (prefer node entry, no shell)
        v
[EdgeMirror CLI process]
        |  local: fetch only http://127.0.0.1:<ephemeral>
        |  remote: deploy edgemirror-tmp-*, fetch only allowlisted *.workers.dev
        |  never follows absolute/SSRF request paths
        v
[Cloudflare API / workers.dev]  (optional)
```

Sandbox boundaries enforced in code:

1. **Request SSRF** — `sanitizeRequestPath` / `resolveWorkerRequestUrl` reject absolute and scheme-relative URLs.
2. **Preview SSRF** — `assertAllowedPreviewUrl` allowlists `*.workers.dev` / `*.cloudflareworkers.com`; blocks RFC1918 / metadata / localhost.
3. **Path containment** — corpus paths must resolve under project root.
4. **Process spawn** — wrangler invoked with argv arrays; prefer `node <wrangler-bin>`; Windows shell fallback never string-joins user args.
5. **Ownership** — cleanup only for `edgemirror-tmp-*` markers; optional `EDGEMIRROR_OWNERSHIP_SECRET` HMAC.
6. **Budgets** — remote runs/duration clamped (`HARD_MAX_REMOTE_*`); response bodies truncated.

## Adversaries

| Actor | Goal | Mitigations |
|-------|------|-------------|
| Malicious PR / fork CI | Exfiltrate secrets / spawn costly Workers | No secrets on fork PRs by default; local-only verify scaffold; runner CI policy helper |
| Malicious corpus / config | SSRF, path escape, oversized payloads | URL/path guards; body size limits |
| Confused deputy | Delete non-EdgeMirror Workers | Name prefix + ownership markers (+ optional MAC) |
| Entitlement forgery (future SaaS) | Unlock paid features | HMAC-signed `em1.` tokens; reject unsigned `{plan}` |
| Cross-tenant access (future SaaS) | Read other orgs | RBAC `assertSameTenant` fail-closed |
| Compromised dependency | RCE via CLI | Minimal deps; SBOM + `npm audit` scripts |
| Webhook spoofing (future) | Fake billing/GitHub events | Stripe/GitHub HMAC validators |

## Runner auth assumptions (future hosted runners)

Documented and tested in `security/runner-auth.ts`:

- Org-scoped bearer tokens `emr_<id>.<secret>`
- Secrets stored hashed; timing-safe compare
- Query-string tokens rejected
- Fork PRs must not receive runner or Cloudflare secrets

## Honest failure modes

| Condition | Behavior |
|-----------|----------|
| Missing Cloudflare credentials | `REMOTE_NOT_CONFIGURED` — no fabricated parity |
| Budget exceeded | `BUDGET_EXCEEDED` — stop remote runs |
| Rejected preview URL | `PREVIEW_URL_REJECTED` |
| Ownership guard fail | Skip delete (do not clean foreign resources) |

## Non-goals

- Protecting a fully compromised developer workstation
- Multi-tenant SaaS isolation in production (no hosted API yet)
- Certification / compliance attestations
