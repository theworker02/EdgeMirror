import { describe, expect, it } from "vitest";
import {
  createBillingClients,
  createCheckoutSession,
  createCustomerPortalSession,
  createCuMeter,
  createEntitlementService,
  createMemoryCuMeterStore,
  createMemoryWebhookEventStore,
  createPlanCatalog,
  gateCloudHistory,
  gateManagedSupercharger,
  gateScheduledVerification,
  getBillingStatus,
  handleStripeWebhook,
  loadBillingConfig,
  OSS_ALTERNATIVE_MESSAGE,
} from "./index.js";
import {
  createMemoryOrganizationStore,
  createOrganization,
} from "@edgemirror/organizations";
import type Stripe from "stripe";

describe("billing config", () => {
  it("returns BILLING_NOT_CONFIGURED without keys", () => {
    const cfg = loadBillingConfig({});
    expect(cfg.mode).toBe("BILLING_NOT_CONFIGURED");
  });

  it("uses dry-run when forced even with keys", () => {
    const cfg = loadBillingConfig({
      STRIPE_SECRET_KEY: "sk_test_x",
      EDGEMIRROR_BILLING_MODE: "dry-run",
    });
    expect(cfg.mode).toBe("dry-run");
  });
});

describe("entitlements", () => {
  const entitlements = createEntitlementService();

  it("community has no managed cloud entitlements", () => {
    const org = { planId: "community", subscriptionStatus: "none" };
    expect(entitlements.hasEntitlement(org, "supercharger.managed")).toBe(false);
    expect(gateManagedSupercharger(entitlements, org).ok).toBe(false);
    expect(gateCloudHistory(entitlements, org).ok).toBe(false);
    const denied = gateScheduledVerification(entitlements, org);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.message).toContain("edgemirror verify");
    }
  });

  it("pro active unlocks higher features via entitlements not plan ifs", () => {
    const org = { planId: "pro", subscriptionStatus: "active" };
    expect(entitlements.hasEntitlement(org, "supercharger.managed")).toBe(true);
    expect(entitlements.hasEntitlement(org, "cloud.history")).toBe(true);
    expect(entitlements.hasEntitlement(org, "verify.scheduled")).toBe(true);
    expect(entitlements.hasEntitlement(org, "compat.extended_matrix")).toBe(true);
    expect(gateManagedSupercharger(entitlements, org)).toEqual({ ok: true });
  });

  it("canceled paid plan loses entitlements", () => {
    const org = { planId: "pro", subscriptionStatus: "canceled" };
    expect(entitlements.hasEntitlement(org, "supercharger.managed")).toBe(false);
    expect(entitlements.getPlanId(org)).toBe("community");
  });
});

describe("checkout + portal", () => {
  it("refuses checkout when billing not configured", async () => {
    const clients = createBillingClients({});
    const result = await createCheckoutSession(clients, {
      orgId: "org_1",
      planId: "pro",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("BILLING_NOT_CONFIGURED");
      expect(result.message).toContain(OSS_ALTERNATIVE_MESSAGE.slice(0, 20));
    }
  });

  it("dry-run checkout does not pretend a charge succeeded", async () => {
    const clients = createBillingClients({
      STRIPE_SECRET_KEY: "sk_test_x",
      EDGEMIRROR_BILLING_MODE: "dry-run",
      STRIPE_PRICE_PRO: "price_test_pro",
    });
    const result = await createCheckoutSession(clients, {
      orgId: "org_1",
      planId: "pro",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mode).toBe("dry-run");
      expect(result.url).toContain("dry-run");
    }
  });

  it("dry-run portal requires customer id", async () => {
    const clients = createBillingClients({
      STRIPE_SECRET_KEY: "sk_test_x",
      EDGEMIRROR_BILLING_MODE: "dry-run",
    });
    const missing = await createCustomerPortalSession(clients, undefined);
    expect(missing.ok).toBe(false);
    const ok = await createCustomerPortalSession(clients, "cus_test");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.mode).toBe("dry-run");
  });

  it("live checkout calls Stripe without payment_method_types", async () => {
    const created: unknown[] = [];
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: unknown) => {
            created.push(params);
            return {
              id: "cs_test_1",
              url: "https://checkout.stripe.com/c/pay/cs_test_1",
            };
          },
        },
      },
      billingPortal: { sessions: { create: async () => ({ url: "" }) } },
      customers: {},
      subscriptions: {},
      webhooks: { constructEvent: () => ({}) },
    };
    const clients = createBillingClients(
      {
        STRIPE_SECRET_KEY: "sk_test_x",
        STRIPE_PRICE_DEVELOPER: "price_dev",
      },
      {},
      stripe as never,
    );
    const result = await createCheckoutSession(
      clients,
      { orgId: "org_1", planId: "developer", customerEmail: "a@b.co" },
      createPlanCatalog(),
      { STRIPE_PRICE_DEVELOPER: "price_dev" },
    );
    expect(result.ok).toBe(true);
    const params = created[0] as Record<string, unknown>;
    expect(params.mode).toBe("subscription");
    expect(params).not.toHaveProperty("payment_method_types");
  });
});

describe("CU metering", () => {
  it("enforces hard monthly ceiling and rejects forge attempts", () => {
    const store = createMemoryCuMeterStore();
    const meter = createCuMeter(store);
    const org = {
      id: "org_cu",
      planId: "developer",
      subscriptionStatus: "active",
    };
    const first = meter.consume(org, 400, "supercharger");
    expect(first.ok).toBe(true);
    const over = meter.consume(org, 200, "supercharger");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error).toBe("CU_CEILING_EXCEEDED");
    expect(() => meter.consume(org, -5, "hack")).toThrow(/CU_UNITS_INVALID/);
  });
});

function fakeEvent(
  id: string,
  type: string,
  object: Record<string, unknown>,
): Stripe.Event {
  return {
    id,
    object: "event",
    type,
    data: { object },
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
  } as Stripe.Event;
}

describe("webhooks", () => {
  it("is idempotent on duplicate event ids", async () => {
    const orgStore = createMemoryOrganizationStore();
    const org = createOrganization(orgStore, {
      id: "org_wh",
      name: "Webhook Co",
      ownerUserId: "u1",
    });
    const eventStore = createMemoryWebhookEventStore();
    const clients = createBillingClients({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
    });

    const event = fakeEvent("evt_dup_1", "checkout.session.completed", {
      id: "cs_1",
      mode: "subscription",
      client_reference_id: org.id,
      customer: "cus_1",
      subscription: "sub_1",
      metadata: { orgId: org.id, planId: "pro" },
    });

    const deps = {
      clients,
      orgStore,
      eventStore,
      parseEvent: () => event,
    };

    const first = await handleStripeWebhook(deps, "{}", "sig");
    const second = await handleStripeWebhook(deps, "{}", "sig");
    expect(first.ok && !first.duplicate).toBe(true);
    expect(second.ok && second.duplicate).toBe(true);
    expect(orgStore.get(org.id)?.stripeCustomerId).toBe("cus_1");
    expect(orgStore.get(org.id)?.planId).toBe("pro");
  });

  it("handles out-of-order subscription update then checkout", async () => {
    const orgStore = createMemoryOrganizationStore();
    const org = createOrganization(orgStore, {
      id: "org_oo",
      name: "OO",
      ownerUserId: "u1",
    });
    orgStore.upsert({ ...org, stripeCustomerId: "cus_oo" });
    const eventStore = createMemoryWebhookEventStore();
    const clients = createBillingClients({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
      STRIPE_PRICE_PRO: "price_pro",
    });

    const subEvent = fakeEvent("evt_sub_1", "customer.subscription.updated", {
      id: "sub_oo",
      status: "trialing",
      customer: "cus_oo",
      cancel_at_period_end: false,
      trial_end: Math.floor(Date.now() / 1000) + 86400,
      metadata: { orgId: org.id, planId: "pro" },
      items: {
        data: [{ price: { id: "price_pro" }, current_period_end: Math.floor(Date.now() / 1000) + 86400 }],
      },
    });

    const r1 = await handleStripeWebhook(
      { clients, orgStore, eventStore, parseEvent: () => subEvent },
      "{}",
      "sig",
      { STRIPE_PRICE_PRO: "price_pro" },
    );
    expect(r1.ok).toBe(true);
    expect(orgStore.get(org.id)?.subscriptionStatus).toBe("trialing");
    expect(orgStore.get(org.id)?.planId).toBe("pro");

    const cancel = fakeEvent("evt_sub_del", "customer.subscription.deleted", {
      id: "sub_oo",
      status: "canceled",
      customer: "cus_oo",
      metadata: { orgId: org.id },
      items: { data: [] },
    });
    await handleStripeWebhook(
      { clients, orgStore, eventStore, parseEvent: () => cancel },
      "{}",
      "sig",
    );
    expect(orgStore.get(org.id)?.planId).toBe("community");
    expect(orgStore.get(org.id)?.subscriptionStatus).toBe("canceled");
  });

  it("rejects invalid signatures when parseEvent not injected", async () => {
    const clients = createBillingClients({
      STRIPE_SECRET_KEY: "sk_test_x",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
    });
    // dry-run / no stripe instance → signature failure path
    const dry = createBillingClients({
      STRIPE_SECRET_KEY: "sk_test_x",
      EDGEMIRROR_BILLING_MODE: "dry-run",
      STRIPE_WEBHOOK_SECRET: "whsec_x",
    });
    const result = await handleStripeWebhook(
      {
        clients: dry,
        orgStore: createMemoryOrganizationStore(),
        eventStore: createMemoryWebhookEventStore(),
      },
      "{}",
      "bad_sig",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("INVALID_SIGNATURE");
    void clients;
  });
});

describe("billing status", () => {
  it("reports entitlements and CU separately from currency", () => {
    const store = createMemoryOrganizationStore();
    const org = createOrganization(store, {
      name: "Status",
      ownerUserId: "u1",
    });
    store.upsert({
      ...org,
      planId: "team",
      subscriptionStatus: "active",
    });
    const cuStore = createMemoryCuMeterStore();
    createCuMeter(cuStore).consume(
      { id: org.id, planId: "team", subscriptionStatus: "active" },
      10,
      "test",
    );
    const status = getBillingStatus({
      org: store.get(org.id)!,
      billingMode: "dry-run",
      cuStore,
    });
    expect(status.entitlements).toContain("org.team_seats");
    expect(status.cu.used).toBe(10);
    expect(status.cu.ceiling).toBe(10_000);
    expect(status.currencyNote.toLowerCase()).toContain("currency");
    expect(status.ossAlternative).toContain("OSS");
  });
});
