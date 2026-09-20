/**
 * Configurable Cloud plan catalog + entitlements.
 * Do NOT scatter `if (plan === "pro")` — query entitlements instead.
 */

export type PlanId =
  | "community"
  | "developer"
  | "pro"
  | "team"
  | "enterprise";

/** Feature gates for Cloud higher-tier capabilities. */
export type EntitlementKey =
  | "supercharger.managed"
  | "cloud.history"
  | "cloud.private_projects"
  | "compat.extended_matrix"
  | "verify.scheduled"
  | "org.team_seats"
  | "org.features";

export interface PlanDefinition {
  id: PlanId;
  displayName: string;
  /** Env var holding Stripe Price id (price_…) — optional for community. */
  priceEnvVar?: string;
  /** USD list price hypothesis for docs / dry-run display (not charged from this number). */
  listPriceUsdMonthly: number;
  /** Included Compute Units per billing month (entitlement ceiling — not currency). */
  monthlyCuCeiling: number;
  seatsIncluded: number;
  entitlements: readonly EntitlementKey[];
  trialDays?: number;
}

/**
 * Default catalog. Price IDs come from env — never hardcode live Stripe prices.
 * Currency (USD) and CU ceilings are intentionally separate fields.
 */
export const DEFAULT_PLANS: readonly PlanDefinition[] = [
  {
    id: "community",
    displayName: "Community (OSS)",
    listPriceUsdMonthly: 0,
    monthlyCuCeiling: 0,
    seatsIncluded: 1,
    entitlements: [],
  },
  {
    id: "developer",
    displayName: "Developer",
    priceEnvVar: "STRIPE_PRICE_DEVELOPER",
    listPriceUsdMonthly: 19,
    monthlyCuCeiling: 500,
    seatsIncluded: 1,
    entitlements: [
      "supercharger.managed",
      "cloud.history",
      "cloud.private_projects",
    ],
    trialDays: 14,
  },
  {
    id: "pro",
    displayName: "Pro",
    priceEnvVar: "STRIPE_PRICE_PRO",
    listPriceUsdMonthly: 49,
    monthlyCuCeiling: 2_500,
    seatsIncluded: 1,
    entitlements: [
      "supercharger.managed",
      "cloud.history",
      "cloud.private_projects",
      "compat.extended_matrix",
      "verify.scheduled",
    ],
    trialDays: 14,
  },
  {
    id: "team",
    displayName: "Team",
    priceEnvVar: "STRIPE_PRICE_TEAM",
    listPriceUsdMonthly: 149,
    monthlyCuCeiling: 10_000,
    seatsIncluded: 5,
    entitlements: [
      "supercharger.managed",
      "cloud.history",
      "cloud.private_projects",
      "compat.extended_matrix",
      "verify.scheduled",
      "org.team_seats",
      "org.features",
    ],
  },
  {
    id: "enterprise",
    displayName: "Enterprise",
    priceEnvVar: "STRIPE_PRICE_ENTERPRISE",
    listPriceUsdMonthly: 0, // custom
    monthlyCuCeiling: 100_000,
    seatsIncluded: 25,
    entitlements: [
      "supercharger.managed",
      "cloud.history",
      "cloud.private_projects",
      "compat.extended_matrix",
      "verify.scheduled",
      "org.team_seats",
      "org.features",
    ],
  },
] as const;

export interface PlanCatalog {
  list(): PlanDefinition[];
  get(planId: string): PlanDefinition | undefined;
  resolvePriceId(planId: PlanId, env?: NodeJS.ProcessEnv): string | undefined;
  planIdForPriceId(priceId: string, env?: NodeJS.ProcessEnv): PlanId | undefined;
}

export function createPlanCatalog(
  plans: readonly PlanDefinition[] = DEFAULT_PLANS,
): PlanCatalog {
  const byId = new Map(plans.map((p) => [p.id, p]));

  return {
    list: () => [...plans],
    get: (planId) => byId.get(planId as PlanId),
    resolvePriceId(planId, env = process.env) {
      const plan = byId.get(planId);
      if (!plan?.priceEnvVar) return undefined;
      const value = env[plan.priceEnvVar]?.trim();
      return value || undefined;
    },
    planIdForPriceId(priceId, env = process.env) {
      for (const plan of plans) {
        if (!plan.priceEnvVar) continue;
        if (env[plan.priceEnvVar]?.trim() === priceId) return plan.id;
      }
      return undefined;
    },
  };
}

export const OSS_ALTERNATIVE_MESSAGE =
  "Prefer self-hosting? The EdgeMirror OSS CLI remains fully capable without Cloud — run `edgemirror verify` locally with zero subscription.";

export function upgradeSuggestion(feature: EntitlementKey): string {
  return (
    `Cloud feature "${feature}" requires a paid EdgeMirror Cloud plan. ` +
    OSS_ALTERNATIVE_MESSAGE
  );
}
