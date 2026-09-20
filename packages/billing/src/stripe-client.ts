/**
 * Stripe client factory. Never stores card numbers — Stripe IDs only.
 * Missing keys → BILLING_NOT_CONFIGURED (dry-run); never pretend charges succeeded.
 */

import Stripe from "stripe";

export type BillingMode = "live" | "dry-run" | "BILLING_NOT_CONFIGURED";

export interface StripeEnvConfig {
  secretKey?: string;
  webhookSecret?: string;
  publicBaseUrl?: string;
  /** Optional Checkout success/cancel overrides */
  checkoutSuccessUrl?: string;
  checkoutCancelUrl?: string;
  portalReturnUrl?: string;
  apiVersion?: string;
}

export interface BillingConfigResult {
  mode: BillingMode;
  secretKey?: string;
  webhookSecret?: string;
  publicBaseUrl: string;
  checkoutSuccessUrl: string;
  checkoutCancelUrl: string;
  portalReturnUrl: string;
}

export function loadBillingConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: StripeEnvConfig = {},
): BillingConfigResult {
  const secretKey = overrides.secretKey ?? env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = overrides.webhookSecret ?? env.STRIPE_WEBHOOK_SECRET?.trim();
  const publicBaseUrl =
    overrides.publicBaseUrl ??
    env.EDGEMIRROR_PUBLIC_BASE_URL?.trim() ??
    "http://localhost:8787";

  const configured = Boolean(secretKey);
  const forceDry = env.EDGEMIRROR_BILLING_MODE === "dry-run";

  let mode: BillingMode;
  if (!configured) {
    mode = "BILLING_NOT_CONFIGURED";
  } else if (forceDry) {
    mode = "dry-run";
  } else {
    mode = "live";
  }

  return {
    mode,
    secretKey: secretKey || undefined,
    webhookSecret: webhookSecret || undefined,
    publicBaseUrl,
    checkoutSuccessUrl:
      overrides.checkoutSuccessUrl ??
      env.STRIPE_CHECKOUT_SUCCESS_URL?.trim() ??
      `${publicBaseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    checkoutCancelUrl:
      overrides.checkoutCancelUrl ??
      env.STRIPE_CHECKOUT_CANCEL_URL?.trim() ??
      `${publicBaseUrl}/billing/cancel`,
    portalReturnUrl:
      overrides.portalReturnUrl ??
      env.STRIPE_PORTAL_RETURN_URL?.trim() ??
      `${publicBaseUrl}/billing`,
  };
}

/** Stripe SDK instance — construct only when a secret key is present. */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    typescript: true,
    appInfo: {
      name: "EdgeMirror Cloud Billing",
      version: "0.1.0",
      url: "https://github.com/theworker02/EdgeMirror",
    },
  });
}

export type StripeLike = Pick<
  Stripe,
  "checkout" | "billingPortal" | "customers" | "subscriptions" | "webhooks"
>;

export interface BillingClients {
  config: BillingConfigResult;
  stripe: StripeLike | null;
}

export function createBillingClients(
  env: NodeJS.ProcessEnv = process.env,
  overrides: StripeEnvConfig = {},
  stripeOverride?: StripeLike | null,
): BillingClients {
  const config = loadBillingConfig(env, overrides);
  if (stripeOverride !== undefined) {
    return { config, stripe: stripeOverride };
  }
  if (config.mode === "BILLING_NOT_CONFIGURED" || !config.secretKey) {
    return { config, stripe: null };
  }
  if (config.mode === "dry-run") {
    // Keys present but dry-run: still allow real Stripe for tests via override only.
    // Without override, do not call Stripe.
    return { config, stripe: null };
  }
  return { config, stripe: createStripeClient(config.secretKey) };
}
