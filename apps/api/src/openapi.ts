/** Minimal OpenAPI stub for Cloud billing surfaces. */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "EdgeMirror Cloud API",
    version: "0.1.0",
    description:
      "Billing + entitlements. CU (Compute Units) are metered entitlements, not currency. OSS CLI is never crippled.",
  },
  paths: {
    "/health": {
      get: { summary: "Health", responses: { "200": { description: "OK" } } },
    },
    "/v1/billing/plans": {
      get: { summary: "List plans", responses: { "200": { description: "Plan catalog" } } },
    },
    "/v1/billing/status": {
      get: {
        summary: "Billing status for an org",
        parameters: [{ name: "orgId", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "Status" } },
      },
    },
    "/v1/billing/checkout": {
      post: { summary: "Create Stripe Checkout Session", responses: { "200": { description: "Session" } } },
    },
    "/v1/billing/portal": {
      post: { summary: "Create Stripe Customer Portal session", responses: { "200": { description: "Portal" } } },
    },
    "/v1/billing/webhooks/stripe": {
      post: {
        summary: "Stripe Billing webhooks (signature required)",
        responses: { "200": { description: "Ack" } },
      },
    },
    "/v1/entitlements/check": {
      post: { summary: "Server-side entitlement check", responses: { "200": { description: "Result" } } },
    },
    "/v1/features/managed-supercharger": {
      post: { summary: "Gate managed Supercharger", responses: { "200": { description: "Allowed" }, "402": { description: "Upgrade" } } },
    },
    "/v1/features/cloud-history": {
      post: { summary: "Gate cloud history retention", responses: { "200": { description: "Allowed" }, "402": { description: "Upgrade" } } },
    },
    "/v1/features/scheduled-verify": {
      post: { summary: "Gate scheduled verification", responses: { "200": { description: "Allowed" }, "402": { description: "Upgrade" } } },
    },
  },
} as const;
