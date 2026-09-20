/**
 * Idempotent Stripe Billing webhook sync → org entitlements.
 * Stores Stripe IDs + status only; never card numbers.
 */

import type Stripe from "stripe";
import type {
  Organization,
  OrganizationStore,
  SubscriptionStatus,
} from "@edgemirror/organizations";
import type { PlanCatalog } from "./plans.js";
import { createPlanCatalog } from "./plans.js";
import type { BillingClients } from "./stripe-client.js";

export interface WebhookEventStore {
  has(eventId: string): boolean;
  mark(eventId: string): void;
}

export function createMemoryWebhookEventStore(): WebhookEventStore {
  const seen = new Set<string>();
  return {
    has: (id) => seen.has(id),
    mark: (id) => {
      seen.add(id);
    },
  };
}

export type WebhookHandleResult =
  | { ok: true; duplicate: true; eventId: string }
  | {
      ok: true;
      duplicate: false;
      eventId: string;
      type: string;
      orgId?: string;
      action: string;
    }
  | {
      ok: false;
      error:
        | "BILLING_NOT_CONFIGURED"
        | "INVALID_SIGNATURE"
        | "WEBHOOK_SECRET_MISSING"
        | "UNHANDLED"
        | "ORG_NOT_FOUND";
      message: string;
    };

export interface WebhookDeps {
  clients: BillingClients;
  orgStore: OrganizationStore;
  eventStore: WebhookEventStore;
  catalog?: PlanCatalog;
  /** Injected for tests — bypass signature when constructing events directly */
  parseEvent?: (rawBody: string | Buffer, signature: string | undefined) => Stripe.Event;
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
      return "unpaid";
    case "paused":
      return "paused";
    default:
      return "none";
  }
}

function subscriptionPeriodEnd(sub: Stripe.Subscription): string | undefined {
  const top = (sub as { current_period_end?: number }).current_period_end;
  const itemEnd = (
    sub.items.data[0] as { current_period_end?: number } | undefined
  )?.current_period_end;
  const unix = top ?? itemEnd ?? sub.ended_at ?? undefined;
  return unix ? new Date(unix * 1000).toISOString() : undefined;
}

function applySubscriptionToOrg(
  org: Organization,
  sub: Stripe.Subscription,
  catalog: PlanCatalog,
  env: NodeJS.ProcessEnv,
): Organization {
  const priceId =
    typeof sub.items.data[0]?.price === "string"
      ? sub.items.data[0]?.price
      : sub.items.data[0]?.price?.id;

  const planFromMeta = sub.metadata?.planId;
  const planFromPrice = priceId
    ? catalog.planIdForPriceId(priceId, env)
    : undefined;
  const planId =
    (planFromMeta && catalog.get(planFromMeta)?.id) ||
    planFromPrice ||
    org.planId;

  return {
    ...org,
    stripeCustomerId:
      typeof sub.customer === "string"
        ? sub.customer
        : sub.customer && "id" in sub.customer
          ? sub.customer.id
          : org.stripeCustomerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId ?? org.stripePriceId,
    planId,
    subscriptionStatus: mapStripeStatus(sub.status),
    trialEndsAt: sub.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : undefined,
    currentPeriodEnd: subscriptionPeriodEnd(sub) ?? org.currentPeriodEnd,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  };
}

function findOrgForSubscription(
  store: OrganizationStore,
  sub: Stripe.Subscription,
): Organization | undefined {
  const orgId = sub.metadata?.orgId;
  if (orgId) {
    const byMeta = store.get(orgId);
    if (byMeta) return byMeta;
  }
  const bySub = store.getByStripeSubscriptionId(sub.id);
  if (bySub) return bySub;
  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : sub.customer && "id" in sub.customer
        ? sub.customer.id
        : undefined;
  if (customerId) return store.getByStripeCustomerId(customerId);
  return undefined;
}

export function constructStripeEvent(
  clients: BillingClients,
  rawBody: string | Buffer,
  signature: string | undefined,
): Stripe.Event {
  if (clients.config.mode === "BILLING_NOT_CONFIGURED") {
    throw new Error("BILLING_NOT_CONFIGURED");
  }
  if (!clients.config.webhookSecret) {
    throw new Error("WEBHOOK_SECRET_MISSING");
  }
  if (!signature) {
    throw new Error("INVALID_SIGNATURE");
  }
  if (!clients.stripe) {
    throw new Error("INVALID_SIGNATURE");
  }
  return clients.stripe.webhooks.constructEvent(
    rawBody,
    signature,
    clients.config.webhookSecret,
  );
}

export async function handleStripeWebhook(
  deps: WebhookDeps,
  rawBody: string | Buffer,
  signature: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Promise<WebhookHandleResult> {
  const catalog = deps.catalog ?? createPlanCatalog();

  if (deps.clients.config.mode === "BILLING_NOT_CONFIGURED" && !deps.parseEvent) {
    return {
      ok: false,
      error: "BILLING_NOT_CONFIGURED",
      message: "Stripe webhooks ignored — STRIPE_SECRET_KEY not configured.",
    };
  }

  let event: Stripe.Event;
  try {
    event = deps.parseEvent
      ? deps.parseEvent(rawBody, signature)
      : constructStripeEvent(deps.clients, rawBody, signature);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("BILLING_NOT_CONFIGURED")) {
      return {
        ok: false,
        error: "BILLING_NOT_CONFIGURED",
        message: msg,
      };
    }
    if (msg.includes("WEBHOOK_SECRET_MISSING")) {
      return {
        ok: false,
        error: "WEBHOOK_SECRET_MISSING",
        message: "Set STRIPE_WEBHOOK_SECRET to verify webhook signatures.",
      };
    }
    return {
      ok: false,
      error: "INVALID_SIGNATURE",
      message: "Stripe signature verification failed.",
    };
  }

  if (deps.eventStore.has(event.id)) {
    return { ok: true, duplicate: true, eventId: event.id };
  }

  const markDone = (action: string, orgId?: string): WebhookHandleResult => {
    deps.eventStore.mark(event.id);
    return {
      ok: true,
      duplicate: false,
      eventId: event.id,
      type: event.type,
      orgId,
      action,
    };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId =
        session.client_reference_id ?? session.metadata?.orgId ?? undefined;
      if (!orgId) {
        return markDone("checkout_no_org");
      }
      const org = deps.orgStore.get(orgId);
      if (!org) {
        return {
          ok: false,
          error: "ORG_NOT_FOUND",
          message: `No org for checkout session orgId=${orgId}`,
        };
      }
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer && "id" in session.customer
            ? session.customer.id
            : undefined;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription && "id" in session.subscription
            ? session.subscription.id
            : undefined;
      deps.orgStore.upsert({
        ...org,
        stripeCustomerId: customerId ?? org.stripeCustomerId,
        stripeSubscriptionId: subId ?? org.stripeSubscriptionId,
        planId: session.metadata?.planId ?? org.planId,
        subscriptionStatus:
          session.mode === "subscription" ? "active" : org.subscriptionStatus,
      });
      return markDone("checkout_linked", orgId);
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const org = findOrgForSubscription(deps.orgStore, sub);
      if (!org) {
        return markDone("subscription_org_pending");
      }
      deps.orgStore.upsert(applySubscriptionToOrg(org, sub, catalog, env));
      return markDone("subscription_synced", org.id);
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const org = findOrgForSubscription(deps.orgStore, sub);
      if (!org) return markDone("subscription_deleted_no_org");
      deps.orgStore.upsert({
        ...org,
        subscriptionStatus: "canceled",
        planId: "community",
        stripeSubscriptionId: undefined,
        stripePriceId: undefined,
        cancelAtPeriodEnd: false,
        trialEndsAt: undefined,
      });
      return markDone("subscription_canceled", org.id);
    }

    case "customer.created":
    case "customer.updated": {
      const customer = event.data.object as Stripe.Customer;
      const orgId = customer.metadata?.orgId;
      if (orgId) {
        const org = deps.orgStore.get(orgId);
        if (org) {
          deps.orgStore.upsert({ ...org, stripeCustomerId: customer.id });
          return markDone("customer_linked", orgId);
        }
      }
      return markDone("customer_noop");
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      return markDone(event.type);
    }

    default:
      deps.eventStore.mark(event.id);
      return {
        ok: true,
        duplicate: false,
        eventId: event.id,
        type: event.type,
        action: "ignored",
      };
  }
}
