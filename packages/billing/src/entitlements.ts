import {
  type EntitlementKey,
  type PlanCatalog,
  type PlanId,
  createPlanCatalog,
  upgradeSuggestion,
} from "./plans.js";

/** Minimal org billing snapshot — synced from Stripe, never client-forged. */
export interface OrgBillingSnapshot {
  planId: string;
  subscriptionStatus: string;
  seatsUsed?: number;
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export interface EntitlementService {
  hasEntitlement(org: OrgBillingSnapshot, key: EntitlementKey): boolean;
  requireEntitlement(
    org: OrgBillingSnapshot,
    key: EntitlementKey,
  ): { ok: true } | { ok: false; error: "ENTITLEMENT_REQUIRED"; message: string };
  listEntitlements(org: OrgBillingSnapshot): EntitlementKey[];
  canUseSeats(org: OrgBillingSnapshot, seatsNeeded: number): boolean;
  getPlanId(org: OrgBillingSnapshot): PlanId;
}

/**
 * Server-side entitlement checks. Clients must never forge plan/CU —
 * always evaluate against org state synced from Stripe webhooks.
 */
export function createEntitlementService(
  catalog: PlanCatalog = createPlanCatalog(),
): EntitlementService {
  const effectivePlan = (org: OrgBillingSnapshot): PlanId => {
    const plan = catalog.get(org.planId);
    if (!plan || plan.id === "community") return "community";
    if (!ACTIVE_STATUSES.has(org.subscriptionStatus)) return "community";
    return plan.id;
  };

  return {
    getPlanId: effectivePlan,

    listEntitlements(org) {
      const plan = catalog.get(effectivePlan(org));
      return plan ? [...plan.entitlements] : [];
    },

    hasEntitlement(org, key) {
      const plan = catalog.get(effectivePlan(org));
      return Boolean(plan?.entitlements.includes(key));
    },

    requireEntitlement(org, key) {
      if (this.hasEntitlement(org, key)) return { ok: true };
      return {
        ok: false,
        error: "ENTITLEMENT_REQUIRED",
        message: upgradeSuggestion(key),
      };
    },

    canUseSeats(org, seatsNeeded) {
      const plan = catalog.get(effectivePlan(org));
      if (!plan) return seatsNeeded <= 1;
      return seatsNeeded <= plan.seatsIncluded;
    },
  };
}

/** Higher-feature gates used by Cloud surfaces. */
export function gateManagedSupercharger(
  entitlements: EntitlementService,
  org: OrgBillingSnapshot,
) {
  return entitlements.requireEntitlement(org, "supercharger.managed");
}

export function gateCloudHistory(
  entitlements: EntitlementService,
  org: OrgBillingSnapshot,
) {
  return entitlements.requireEntitlement(org, "cloud.history");
}

export function gateScheduledVerification(
  entitlements: EntitlementService,
  org: OrgBillingSnapshot,
) {
  return entitlements.requireEntitlement(org, "verify.scheduled");
}

export function gateExtendedCompatMatrix(
  entitlements: EntitlementService,
  org: OrgBillingSnapshot,
) {
  return entitlements.requireEntitlement(org, "compat.extended_matrix");
}

export function gatePrivateProjects(
  entitlements: EntitlementService,
  org: OrgBillingSnapshot,
) {
  return entitlements.requireEntitlement(org, "cloud.private_projects");
}
