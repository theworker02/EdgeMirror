import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createApiRuntime, handleApiRequest } from "./index.js";

async function withServer(
  runtime: ReturnType<typeof createApiRuntime>,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer((req, res) => {
    void handleApiRequest(runtime, req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe("api billing routes", () => {
  it("reports BILLING_NOT_CONFIGURED and gates features", async () => {
    const runtime = createApiRuntime({});
    await withServer(runtime, async (base) => {
      const status = await fetch(`${base}/v1/billing/status?orgId=org_api`);
      expect(status.status).toBe(200);
      const body = (await status.json()) as { mode: string; entitlements: string[] };
      expect(body.mode).toBe("BILLING_NOT_CONFIGURED");
      expect(body.entitlements).toEqual([]);

      const checkout = await fetch(`${base}/v1/billing/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: "org_api", planId: "pro" }),
      });
      const checkoutBody = (await checkout.json()) as { ok: boolean; error?: string };
      expect(checkoutBody.ok).toBe(false);
      expect(checkoutBody.error).toBe("BILLING_NOT_CONFIGURED");

      const feature = await fetch(`${base}/v1/features/managed-supercharger`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: "org_api" }),
      });
      expect(feature.status).toBe(402);

      const plans = await fetch(`${base}/v1/billing/plans`);
      expect(plans.status).toBe(200);
    });
  });

  it("dry-run checkout succeeds without claiming a live charge", async () => {
    const runtime = createApiRuntime({
      STRIPE_SECRET_KEY: "sk_test_x",
      EDGEMIRROR_BILLING_MODE: "dry-run",
      STRIPE_PRICE_PRO: "price_pro",
    });
    await withServer(runtime, async (base) => {
      const checkout = await fetch(`${base}/v1/billing/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId: "org_dry", planId: "pro" }),
      });
      const body = (await checkout.json()) as { ok: boolean; mode?: string };
      expect(body.ok).toBe(true);
      expect(body.mode).toBe("dry-run");
    });
  });
});
