# Agent Stripe — final handoff (for Agent 6 / agent/release)

## Merge

**Branch to merge:** `agent/stripe`  
**Base:** Phase 4 checkpoint `e364c77` (same as `agent/release` at sprint start)

## What lands

| Path | Purpose |
|------|---------|
| `packages/organizations/` | Org ↔ Stripe IDs |
| `packages/billing/` | Stripe Billing + entitlements + CU |
| `apps/api/` | Control-plane billing HTTP + webhooks |
| `packages/cli/src/cli/commands/cloud.ts` | `edgemirror cloud billing` |
| `docs/BILLING.md` | Operator docs + env list |
| Root `package.json` | workspaces `apps/*`, `test:billing`, build order |

## Verify before merge

```bash
npm install
npm run test:billing
npm run build -w @edgemirror/organizations -w @edgemirror/billing -w @edgemirror/api
```

## Merge notes / conflicts

- Root `package.json` workspaces/scripts will conflict if other agents also expand workspaces — keep `apps/*` and billing test scripts.
- CLI `bin.ts` only adds `cloud` command — merge carefully with other CLI edits.
- Empty Phase 4 dirs (`packages/control-plane`, etc.) remain empty — safe to ignore or delete later.
- Does **not** require Cloudflare endorsement language changes (Agent 2).

## Security handoff

Webhook path: `POST /v1/billing/webhooks/stripe` → `handleStripeWebhook` with signature verification. Invalid signature → 400 `INVALID_SIGNATURE`. Idempotent on `event.id`.

## Product honesty

- No fabricated revenue/customers/live charges in repo.
- `BILLING_NOT_CONFIGURED` / dry-run when keys missing.
- CU ≠ currency; OSS CLI never crippled.
