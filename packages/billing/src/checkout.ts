import type { PlanCatalog, PlanId } from "./plans.js";
import { createPlanCatalog, OSS_ALTERNATIVE_MESSAGE } from "./plans.js";
import type { BillingClients } from "./stripe-client.js";

export interface CheckoutRequest {
  orgId: string;
  planId: PlanId;
  customerEmail?: string;
  /** Existing Stripe customer id if already linked */
  stripeCustomerId?: string;
  trialDays?: number;
}

export type CheckoutResult =
  | {
      ok: true;
      mode: "live";
      sessionId: string;
      url: string;
    }
  | {
      ok: true;
      mode: "dry-run";
      sessionId: string;
      url: string;
      note: string;
    }
  | {
      ok: false;
      error: "BILLING_NOT_CONFIGURED" | "INVALID_PLAN" | "PRICE_NOT_CONFIGURED" | "STRIPE_ERROR";
      message: string;
    };

/**
 * Create a Stripe Checkout Session in subscription mode.
 * Never passes payment_method_types (dynamic payment methods).
 */
export async function createCheckoutSession(
  clients: BillingClients,
  request: CheckoutRequest,
  catalog: PlanCatalog = createPlanCatalog(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<CheckoutResult> {
  const plan = catalog.get(request.planId);
  if (!plan || plan.id === "community") {
    return {
      ok: false,
      error: "INVALID_PLAN",
      message: `Cannot checkout plan "${request.planId}". Community/OSS is free — ${OSS_ALTERNATIVE_MESSAGE}`,
    };
  }

  const priceId = catalog.resolvePriceId(plan.id, env);
  if (!priceId && clients.config.mode === "live") {
    return {
      ok: false,
      error: "PRICE_NOT_CONFIGURED",
      message: `Set ${plan.priceEnvVar} to a Stripe Price id before creating Checkout sessions.`,
    };
  }

  if (clients.config.mode === "BILLING_NOT_CONFIGURED") {
    return {
      ok: false,
      error: "BILLING_NOT_CONFIGURED",
      message:
        "Stripe is not configured (missing STRIPE_SECRET_KEY). No charge was attempted. " +
        OSS_ALTERNATIVE_MESSAGE,
    };
  }

  if (clients.config.mode === "dry-run" || !clients.stripe) {
    const fakeId = `cs_test_dry_${request.orgId}_${plan.id}`;
    return {
      ok: true,
      mode: "dry-run",
      sessionId: fakeId,
      url: `${clients.config.publicBaseUrl}/billing/dry-run/checkout?session_id=${fakeId}&plan=${plan.id}`,
      note: "Dry-run Checkout — no Stripe charge created. Set EDGEMIRROR_BILLING_MODE=live with keys to charge.",
    };
  }

  try {
    const trial =
      request.trialDays ?? plan.trialDays ?? undefined;
    // integration_identifier for Dashboard funnel tracking (8-char suffix)
    const integrationIdentifier = `em-cloud-sub-${randomSuffix(8)}`;

    const session = await clients.stripe.checkout.sessions.create({
      mode: "subscription",
      // Do NOT set payment_method_types — enable dynamic payment methods.
      customer: request.stripeCustomerId,
      customer_email: request.stripeCustomerId
        ? undefined
        : request.customerEmail,
      line_items: [{ price: priceId!, quantity: 1 }],
      success_url: clients.config.checkoutSuccessUrl,
      cancel_url: clients.config.checkoutCancelUrl,
      client_reference_id: request.orgId,
      metadata: {
        orgId: request.orgId,
        planId: plan.id,
      },
      subscription_data: {
        metadata: {
          orgId: request.orgId,
          planId: plan.id,
        },
        ...(trial ? { trial_period_days: trial } : {}),
      },
      ...({ integration_identifier: integrationIdentifier } as object),
    } as never);

    if (!session.url) {
      return {
        ok: false,
        error: "STRIPE_ERROR",
        message: "Checkout session created without URL",
      };
    }

    return {
      ok: true,
      mode: "live",
      sessionId: session.id,
      url: session.url,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "STRIPE_ERROR", message };
  }
}

export type PortalResult =
  | { ok: true; mode: "live"; url: string }
  | { ok: true; mode: "dry-run"; url: string; note: string }
  | {
      ok: false;
      error: "BILLING_NOT_CONFIGURED" | "NO_CUSTOMER" | "STRIPE_ERROR";
      message: string;
    };

export async function createCustomerPortalSession(
  clients: BillingClients,
  stripeCustomerId: string | undefined,
): Promise<PortalResult> {
  if (clients.config.mode === "BILLING_NOT_CONFIGURED") {
    return {
      ok: false,
      error: "BILLING_NOT_CONFIGURED",
      message:
        "Stripe is not configured (missing STRIPE_SECRET_KEY). Portal unavailable. " +
        OSS_ALTERNATIVE_MESSAGE,
    };
  }

  if (!stripeCustomerId) {
    return {
      ok: false,
      error: "NO_CUSTOMER",
      message: "Organization has no Stripe customer yet — complete Checkout first.",
    };
  }

  if (clients.config.mode === "dry-run" || !clients.stripe) {
    return {
      ok: true,
      mode: "dry-run",
      url: `${clients.config.publicBaseUrl}/billing/dry-run/portal?customer=${stripeCustomerId}`,
      note: "Dry-run Customer Portal — no Stripe session created.",
    };
  }

  try {
    const session = await clients.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: clients.config.portalReturnUrl,
    });
    return { ok: true, mode: "live", url: session.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: "STRIPE_ERROR", message };
  }
}

function randomSuffix(len: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  }
  return out;
}
