# Agent Stripe — status

**Branch:** `agent/stripe` (from Phase 4 checkpoint `e364c77` / agent/release base)  
**Date:** 2026-09-19  
**Owner:** Agent Stripe (billing)

## Done

- `@edgemirror/organizations` — org store, Stripe customer/subscription ID link, seats
- `@edgemirror/billing` — plan catalog, entitlements, Checkout, Portal, CU meter, idempotent webhooks
- `@edgemirror/api` (`apps/api`) — `/v1/billing/*`, feature gates, OpenAPI stub, `0.0.0.0:$PORT`
- CLI: `edgemirror cloud billing` (status only; OSS verify untouched)
- Docs: `docs/BILLING.md`

## Entitlement gates (examples)

- `supercharger.managed`
- `cloud.history`
- `verify.scheduled`
- (+ `compat.extended_matrix`, private projects, org seats)

## Coordination

- **Agent 3 (security):** webhook signatures via `stripe.webhooks.constructEvent`; tests inject `parseEvent` — do not disable verification.
- **Agent 6 (release):** merge `agent/stripe`; see `agent-stripe-final.md`.
- Stay out of Cloudflare/brand/docs/supercharger primary files.

## Test command

```bash
npm run test:billing
```

## Env (test mode)

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` — missing keys → `BILLING_NOT_CONFIGURED`.
