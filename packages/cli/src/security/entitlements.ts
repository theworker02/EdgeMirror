/**
 * Billing entitlement claims — HMAC-signed, expiry-checked, forgery-resistant.
 * Client-supplied unsigned plan strings must never grant features.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type PlanId = "free" | "pro" | "team" | "enterprise";

export interface EntitlementClaims {
  orgId: string;
  plan: PlanId;
  /** Feature flags explicitly granted. */
  features: string[];
  /** Unix seconds. */
  exp: number;
  /** Unix seconds issued at. */
  iat: number;
  /** Opaque subscription / invoice id from billing provider. */
  subId: string;
}

export class EntitlementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntitlementError";
  }
}

const PLAN_FEATURES: Record<PlanId, readonly string[]> = {
  free: ["verify:local", "reports:json"],
  pro: ["verify:local", "verify:remote", "reports:json", "reports:html", "preview"],
  team: [
    "verify:local",
    "verify:remote",
    "reports:json",
    "reports:html",
    "preview",
    "org:sso",
    "runner:hosted",
  ],
  enterprise: [
    "verify:local",
    "verify:remote",
    "reports:json",
    "reports:html",
    "preview",
    "org:sso",
    "runner:hosted",
    "audit:export",
    "sla",
  ],
};

function b64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function signPayload(secret: string, payloadB64: string): string {
  return b64url(createHmac("sha256", secret).update(payloadB64).digest());
}

function safeEqualB64(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Issue a signed entitlement token (server-side only). */
export function issueEntitlement(
  secret: string,
  claims: EntitlementClaims,
): string {
  if (!secret || secret.length < 16) {
    throw new EntitlementError("Entitlement signing secret too weak");
  }
  if (!claims.orgId || !claims.subId) {
    throw new EntitlementError("orgId and subId required");
  }
  if (!PLAN_FEATURES[claims.plan]) {
    throw new EntitlementError(`Unknown plan: ${claims.plan}`);
  }
  const payloadB64 = b64url(JSON.stringify(claims));
  const sig = signPayload(secret, payloadB64);
  return `em1.${payloadB64}.${sig}`;
}

/**
 * Verify and parse an entitlement token.
 * Rejects missing/invalid signatures, expiry, and feature claims not in plan.
 */
export function verifyEntitlement(
  secret: string,
  token: string,
  opts: { nowSeconds?: number; expectedOrgId?: string } = {},
): EntitlementClaims {
  if (!secret || !token) {
    throw new EntitlementError("Entitlement token and secret required");
  }
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "em1") {
    throw new EntitlementError("Malformed entitlement token");
  }
  const [, payloadB64, sig] = parts;
  const expected = signPayload(secret, payloadB64);
  if (!safeEqualB64(expected, sig)) {
    throw new EntitlementError("Entitlement signature invalid");
  }

  let claims: EntitlementClaims;
  try {
    claims = JSON.parse(fromB64url(payloadB64).toString("utf8")) as EntitlementClaims;
  } catch {
    throw new EntitlementError("Entitlement payload corrupt");
  }

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now) {
    throw new EntitlementError("Entitlement expired");
  }
  if (typeof claims.iat !== "number" || claims.iat > now + 60) {
    throw new EntitlementError("Entitlement iat invalid");
  }
  if (opts.expectedOrgId && claims.orgId !== opts.expectedOrgId) {
    throw new EntitlementError("Entitlement org mismatch");
  }

  const allowed = new Set(PLAN_FEATURES[claims.plan] ?? []);
  for (const f of claims.features ?? []) {
    if (!allowed.has(f)) {
      throw new EntitlementError(`Feature not in plan: ${f}`);
    }
  }

  return claims;
}

/**
 * Reject client-forged plan strings — only signed tokens grant features.
 */
export function assertFeature(
  secret: string,
  token: string | undefined,
  feature: string,
  expectedOrgId?: string,
): EntitlementClaims {
  if (!token) {
    throw new EntitlementError("Entitlement required");
  }
  const claims = verifyEntitlement(secret, token, { expectedOrgId });
  if (!claims.features.includes(feature) && !(PLAN_FEATURES[claims.plan] ?? []).includes(feature)) {
    throw new EntitlementError(`Plan lacks feature: ${feature}`);
  }
  return claims;
}

/** Unsigned body like `{ plan: "enterprise" }` must never succeed. */
export function rejectUnsignedPlanClaim(body: unknown): void {
  if (body && typeof body === "object" && "plan" in body && !("token" in body)) {
    throw new EntitlementError(
      "Unsigned plan claims are rejected; supply a signed entitlement token",
    );
  }
}

export function featuresForPlan(plan: PlanId): readonly string[] {
  return PLAN_FEATURES[plan];
}
