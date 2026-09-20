# Threat Model (abbreviated)

## Assets

- Cloudflare API tokens / account access
- Customer Worker source and binding configuration
- Evidence artifacts (may contain response bodies)
- Temporary cloud resources created during tests

## Adversaries

| Actor | Goal | Mitigations |
|-------|------|-------------|
| Malicious PR in CI | Exfiltrate secrets / spawn costly Workers | No secrets on fork PRs by default; budgets; ownership cleanup |
| Compromised dependency | RCE via CLI | Minimal deps; pin versions; review wrangler |
| Curious local user | Read `.edgemirror` artifacts | Redaction; document sensitivity |
| Confused deputy | Delete non-EdgeMirror Workers | Ownership markers required for cleanup |

## Non-goals

- Protecting against a fully compromised developer workstation
- Multi-tenant SaaS isolation (no hosted cloud in this phase)

## Honest failure modes

Missing credentials → `REMOTE_NOT_CONFIGURED` (no fabricated parity).  
Budget exceeded → `BUDGET_EXCEEDED` traces, stop remote runs.
