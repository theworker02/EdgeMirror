/**
 * Webhook signature validation (GitHub + Stripe-compatible HMAC).
 * Library primitives for future control-plane; no network I/O.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export class WebhookValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookValidationError";
  }
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length === 0 || ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function safeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function hmacSha256Hex(secret: string, payload: string | Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * GitHub webhook: `X-Hub-Signature-256: sha256=<hex>`.
 */
export function verifyGitHubWebhook(input: {
  secret: string;
  payload: string | Buffer;
  signatureHeader: string | undefined;
}): void {
  if (!input.secret) {
    throw new WebhookValidationError("Webhook secret is required");
  }
  if (!input.signatureHeader) {
    throw new WebhookValidationError("Missing X-Hub-Signature-256 header");
  }
  const match = input.signatureHeader.match(/^sha256=([a-f0-9]{64})$/i);
  if (!match) {
    throw new WebhookValidationError("Malformed GitHub signature header");
  }
  const expected = hmacSha256Hex(input.secret, input.payload);
  if (!safeEqualHex(expected, match[1].toLowerCase())) {
    throw new WebhookValidationError("GitHub webhook signature mismatch");
  }
}

/**
 * Stripe-compatible: `Stripe-Signature: t=<unix>,v1=<hex>[,v1=...]`
 * Rejects timestamps outside tolerance to limit replay.
 */
export function verifyStripeWebhook(input: {
  secret: string;
  payload: string | Buffer;
  signatureHeader: string | undefined;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): void {
  if (!input.secret) {
    throw new WebhookValidationError("Webhook secret is required");
  }
  if (!input.signatureHeader) {
    throw new WebhookValidationError("Missing Stripe-Signature header");
  }

  const parts = Object.fromEntries(
    input.signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  ) as Record<string, string>;

  const timestamp = parts.t;
  if (!timestamp || !/^\d+$/.test(timestamp)) {
    throw new WebhookValidationError("Missing Stripe timestamp");
  }

  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > tolerance) {
    throw new WebhookValidationError("Stripe webhook timestamp outside tolerance");
  }

  const payloadString =
    typeof input.payload === "string"
      ? input.payload
      : input.payload.toString("utf8");
  const signed = `${timestamp}.${payloadString}`;
  const expected = hmacSha256Hex(input.secret, signed);

  const candidates = input.signatureHeader
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3).toLowerCase());

  if (candidates.length === 0) {
    throw new WebhookValidationError("Missing Stripe v1 signature");
  }

  const ok = candidates.some((c) => safeEqualHex(expected, c));
  if (!ok) {
    throw new WebhookValidationError("Stripe webhook signature mismatch");
  }
}

/** Generic HMAC-SHA256 header compare (`sha256=<hex>` or raw hex). */
export function verifyHmacHeader(input: {
  secret: string;
  payload: string | Buffer;
  header: string | undefined;
}): void {
  if (!input.secret || !input.header) {
    throw new WebhookValidationError("HMAC secret and header are required");
  }
  const hex = input.header.replace(/^sha256=/i, "").toLowerCase();
  const expected = hmacSha256Hex(input.secret, input.payload);
  if (!safeEqualHex(expected, hex)) {
    throw new WebhookValidationError("HMAC signature mismatch");
  }
}

export function constantTimeEqualString(a: string, b: string): boolean {
  return safeEqualUtf8(a, b);
}
