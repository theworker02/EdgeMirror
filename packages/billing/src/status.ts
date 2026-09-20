import type { Organization } from "@edgemirror/organizations";
import {
  createEntitlementService,
  type EntitlementService,
} from "./entitlements.js";
import {
  createPlanCatalog,
  OSS_ALTERNATIVE_MESSAGE,
  type PlanCatalog,
} from "./plans.js";
import {
  createMemoryCuMeterStore,
  currentCuPeriod,
  type CuMeterStore,
} from "./metering.js";
import type { BillingConfigResult } from "./stripe-client.js";

export interface BillingStatusView {
  mode: BillingConfigResult["mode"];
  orgId: string;
  planId: string;
  effectivePlanId: string;
  subscriptionStatus: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  entitlements: string[];
  cu: { used: number; ceiling: number; remaining: number; period: string };
  currencyNote: string;
  ossAlternative: string;
}

export function getBillingStatus(input: {
  org: Organization;
  billingMode: BillingConfigResult["mode"];
  entitlements?: EntitlementService;
  catalog?: PlanCatalog;
  cuStore?: CuMeterStore;
}): BillingStatusView {
  const catalog = input.catalog ?? createPlanCatalog();
  const entitlements = input.entitlements ?? createEntitlementService(catalog);
  const cuStore = input.cuStore ?? createMemoryCuMeterStore();
  const effectivePlanId = entitlements.getPlanId(input.org);
  const period = currentCuPeriod();
  const plan = catalog.get(effectivePlanId);
  const active =
    input.org.subscriptionStatus === "active" ||
    input.org.subscriptionStatus === "trialing";
  const ceiling = active && plan ? plan.monthlyCuCeiling : 0;
  const used = cuStore.sum(input.org.id, period);

  return {
    mode: input.billingMode,
    orgId: input.org.id,
    planId: input.org.planId,
    effectivePlanId,
    subscriptionStatus: input.org.subscriptionStatus,
    stripeCustomerId: input.org.stripeCustomerId,
    stripeSubscriptionId: input.org.stripeSubscriptionId,
    cancelAtPeriodEnd: input.org.cancelAtPeriodEnd,
    trialEndsAt: input.org.trialEndsAt,
    currentPeriodEnd: input.org.currentPeriodEnd,
    entitlements: entitlements.listEntitlements(input.org),
    cu: {
      used,
      ceiling,
      remaining: Math.max(0, ceiling - used),
      period,
    },
    currencyNote:
      "Billing currency (USD via Stripe) is separate from Compute Units (CU) entitlements.",
    ossAlternative: OSS_ALTERNATIVE_MESSAGE,
  };
}
