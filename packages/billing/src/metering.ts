/**
 * Compute Unit (CU) metering — entitlements, not currency.
 * Hard monthly ceilings come from the plan catalog. Clients cannot forge balances.
 */

import type { PlanCatalog } from "./plans.js";
import { createPlanCatalog } from "./plans.js";
import type { OrgBillingSnapshot } from "./entitlements.js";

export interface CuUsageRecord {
  orgId: string;
  /** YYYY-MM billing period key (UTC) */
  period: string;
  units: number;
  reason: string;
  recordedAt: string;
  /** Opaque server-issued id — never accept client-supplied balances */
  id: string;
}

export interface CuMeterStore {
  append(record: CuUsageRecord): void;
  sum(orgId: string, period: string): number;
  list(orgId: string, period: string): CuUsageRecord[];
}

export function createMemoryCuMeterStore(): CuMeterStore {
  const records: CuUsageRecord[] = [];
  return {
    append(record) {
      records.push(record);
    },
    sum(orgId, period) {
      return records
        .filter((r) => r.orgId === orgId && r.period === period)
        .reduce((n, r) => n + r.units, 0);
    },
    list(orgId, period) {
      return records.filter((r) => r.orgId === orgId && r.period === period);
    },
  };
}

export function currentCuPeriod(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export type CuConsumeResult =
  | { ok: true; used: number; ceiling: number; remaining: number; period: string }
  | {
      ok: false;
      error: "CU_CEILING_EXCEEDED" | "CU_NOT_INCLUDED";
      used: number;
      ceiling: number;
      message: string;
    };

export interface CuMeter {
  getUsage(orgId: string, period?: string): { used: number; ceiling: number; period: string };
  consume(
    org: OrgBillingSnapshot & { id: string },
    units: number,
    reason: string,
  ): CuConsumeResult;
}

export function createCuMeter(
  store: CuMeterStore = createMemoryCuMeterStore(),
  catalog: PlanCatalog = createPlanCatalog(),
): CuMeter {
  const ceilingFor = (org: OrgBillingSnapshot): number => {
    const plan = catalog.get(org.planId);
    if (!plan || org.subscriptionStatus === "none" || org.subscriptionStatus === "canceled") {
      if (plan?.id === "community" || !plan) return 0;
    }
    const active =
      org.subscriptionStatus === "active" || org.subscriptionStatus === "trialing";
    if (!active) return 0;
    return plan.monthlyCuCeiling;
  };

  return {
    getUsage(orgId, period = currentCuPeriod()) {
      // Ceiling requires org snapshot — callers with only orgId get used amount;
      // full ceiling resolution happens in consume / status APIs.
      return { used: store.sum(orgId, period), ceiling: -1, period };
    },

    consume(org, units, reason) {
      if (!Number.isFinite(units) || units <= 0) {
        throw new Error("CU_UNITS_INVALID");
      }
      // Reject client-forged negative / absurd values
      if (units > 1_000_000) {
        throw new Error("CU_UNITS_INVALID");
      }

      const period = currentCuPeriod();
      const ceiling = ceilingFor(org);
      const used = store.sum(org.id, period);

      if (ceiling <= 0) {
        return {
          ok: false,
          error: "CU_NOT_INCLUDED",
          used,
          ceiling,
          message:
            "Managed Compute Units are not included on this plan. Upgrade Cloud or run the OSS CLI locally (`edgemirror verify`).",
        };
      }

      if (used + units > ceiling) {
        return {
          ok: false,
          error: "CU_CEILING_EXCEEDED",
          used,
          ceiling,
          message: `Monthly CU ceiling reached (${used}/${ceiling}). Upgrade plan or wait for the next period. OSS alternative: run verify locally.`,
        };
      }

      store.append({
        id: `cu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        orgId: org.id,
        period,
        units,
        reason,
        recordedAt: new Date().toISOString(),
      });

      const nextUsed = used + units;
      return {
        ok: true,
        used: nextUsed,
        ceiling,
        remaining: ceiling - nextUsed,
        period,
      };
    },
  };
}

/** Resolve usage + ceiling for status APIs (server-side org snapshot required). */
export function getCuBudget(
  meter: CuMeter,
  store: CuMeterStore,
  org: OrgBillingSnapshot & { id: string },
  catalog: PlanCatalog = createPlanCatalog(),
  period = currentCuPeriod(),
): { used: number; ceiling: number; remaining: number; period: string } {
  const plan = catalog.get(org.planId);
  const active =
    org.subscriptionStatus === "active" || org.subscriptionStatus === "trialing";
  const ceiling = active && plan ? plan.monthlyCuCeiling : 0;
  const used = store.sum(org.id, period);
  return { used, ceiling, remaining: Math.max(0, ceiling - used), period };
}
