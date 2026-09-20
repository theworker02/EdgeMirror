# EdgeMirror Cloud Billing

Stripe Billing for EdgeMirror Cloud higher-tier features. **Not cryptocurrency.** Compute Units (CU) are metered entitlements included with plans — keep billing currency (USD via Stripe) and CU separate.

The OSS CLI (`edgemirror verify`, etc.) remains fully capable without a Cloud subscription.

## Packages

| Package | Role |
|---------|------|
| `@edgemirror/billing` | Plans, entitlements, Checkout, Customer Portal, webhooks, CU metering |
| `@edgemirror/organizations` | Org ↔ Stripe customer / subscription IDs (never card numbers) |
| `@edgemirror/api` | HTTP routes + Stripe webhook endpoint |

## Plans (configurable)

| Plan | Default list price (hypothesis) | Monthly CU ceiling | Notes |
|------|---------------------------------|--------------------|-------|
| Community | $0 | 0 | OSS — no managed Cloud entitlements |
| Developer | $19 | 500 | Managed Supercharger, history, private projects |
| Pro | $49 | 2,500 | + extended compat matrix, scheduled verify |
| Team | $149 | 10,000 | + team seats / org features |
| Enterprise | custom | 100,000 | Same entitlements, higher ceilings |

Prices are **not** charged from these numbers — Stripe Price IDs in env are authoritative.

## Entitlements

Do **not** scatter `if (plan === "pro")`. Use:

```ts
import { createEntitlementService } from "@edgemirror/billing";

const entitlements = createEntitlementService();
if (!entitlements.hasEntitlement(org, "supercharger.managed")) {
  // show upgrade + OSS alternative messaging
}
```

Keys include: `supercharger.managed`, `cloud.history`, `cloud.private_projects`, `compat.extended_matrix`, `verify.scheduled`, `org.team_seats`, `org.features`.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `STRIPE_SECRET_KEY` | for live | Stripe secret (`sk_test_…` in test mode). Prefer restricted keys (`rk_`) in production. |
| `STRIPE_WEBHOOK_SECRET` | for webhooks | Signing secret (`whsec_…`) — Agent 3 / security: verify signatures |
| `STRIPE_PRICE_DEVELOPER` | for Developer checkout | Stripe Price id |
| `STRIPE_PRICE_PRO` | for Pro checkout | Stripe Price id |
| `STRIPE_PRICE_TEAM` | for Team checkout | Stripe Price id |
| `STRIPE_PRICE_ENTERPRISE` | for Enterprise | Stripe Price id |
| `EDGEMIRROR_PUBLIC_BASE_URL` | optional | Default `http://localhost:8787` |
| `STRIPE_CHECKOUT_SUCCESS_URL` | optional | Checkout success redirect |
| `STRIPE_CHECKOUT_CANCEL_URL` | optional | Checkout cancel redirect |
| `STRIPE_PORTAL_RETURN_URL` | optional | Customer Portal return |
| `EDGEMIRROR_BILLING_MODE` | optional | Set `dry-run` to never call Stripe even if keys exist |
| `PORT` | optional | API listen port (binds `0.0.0.0`) |
| `EDGEMIRROR_API_URL` | optional | CLI `cloud billing` target |

When `STRIPE_SECRET_KEY` is missing, APIs return **`BILLING_NOT_CONFIGURED`** and never pretend a charge succeeded.

## Flows

1. **Subscribe** — `POST /v1/billing/checkout` → Stripe Checkout Session (`mode: subscription`). No `payment_method_types` (dynamic payment methods).
2. **Manage** — `POST /v1/billing/portal` → Stripe Customer Portal (plan changes, cancel, payment method).
3. **Sync** — `POST /v1/billing/webhooks/stripe` — idempotent by event id; updates org plan / status / period / trial / cancellation.

## Local test

```bash
npm run test:billing
npm run build -w @edgemirror/api
# optional: STRIPE_SECRET_KEY=sk_test_… npm run api
edgemirror cloud billing --org org_demo
```

## Tax note

If charging US/EU customers in production, enable [Stripe Tax](https://docs.stripe.com/billing/taxes/collect-taxes) and complete tax registrations before relying on `automatic_tax`. EdgeMirror Cloud does not enable automatic tax by default in this scaffold.

## Security coordination

Webhook signature verification lives in `@edgemirror/billing` (`constructEvent`). Agent 3 (security) should treat invalid signatures as hard failures — do not weaken verification for tests; inject `parseEvent` in unit tests instead.
