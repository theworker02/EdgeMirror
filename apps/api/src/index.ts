/**
 * Minimal EdgeMirror Cloud API — billing + entitlements.
 * Bind to 0.0.0.0:$PORT for Render-compatible deploys.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  createBillingClients,
  createCheckoutSession,
  createCustomerPortalSession,
  createEntitlementService,
  createMemoryCuMeterStore,
  createMemoryWebhookEventStore,
  createPlanCatalog,
  gateCloudHistory,
  gateManagedSupercharger,
  gateScheduledVerification,
  getBillingStatus,
  handleStripeWebhook,
  type EntitlementKey,
} from "@edgemirror/billing";
import {
  createMemoryOrganizationStore,
  createOrganization,
  type OrganizationStore,
} from "@edgemirror/organizations";

export interface ApiRuntime {
  orgStore: OrganizationStore;
  eventStore: ReturnType<typeof createMemoryWebhookEventStore>;
  cuStore: ReturnType<typeof createMemoryCuMeterStore>;
  entitlements: ReturnType<typeof createEntitlementService>;
  catalog: ReturnType<typeof createPlanCatalog>;
  env: NodeJS.ProcessEnv;
}

export function createApiRuntime(env: NodeJS.ProcessEnv = process.env): ApiRuntime {
  return {
    orgStore: createMemoryOrganizationStore(),
    eventStore: createMemoryWebhookEventStore(),
    cuStore: createMemoryCuMeterStore(),
    entitlements: createEntitlementService(),
    catalog: createPlanCatalog(),
    env,
  };
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}

function ensureOrg(runtime: ApiRuntime, orgId: string) {
  let org = runtime.orgStore.get(orgId);
  if (!org) {
    org = createOrganization(runtime.orgStore, {
      id: orgId,
      name: orgId,
      ownerUserId: "api-bootstrap",
    });
  }
  return org;
}

export async function handleApiRequest(
  runtime: ApiRuntime,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = (req.method ?? "GET").toUpperCase();
  const clients = createBillingClients(runtime.env);

  if (method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, service: "edgemirror-api" });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/billing/plans") {
    sendJson(res, 200, {
      plans: runtime.catalog.list().map((p) => ({
        id: p.id,
        displayName: p.displayName,
        listPriceUsdMonthly: p.listPriceUsdMonthly,
        monthlyCuCeiling: p.monthlyCuCeiling,
        seatsIncluded: p.seatsIncluded,
        entitlements: p.entitlements,
      })),
      note: "USD list prices are hypotheses for Checkout Price IDs; CU is not currency.",
      ossAlternative:
        "Community/OSS CLI remains fully capable without Cloud — `edgemirror verify`.",
    });
    return;
  }

  if (method === "GET" && url.pathname === "/v1/billing/status") {
    const orgId = url.searchParams.get("orgId") ?? "org_demo";
    const org = ensureOrg(runtime, orgId);
    sendJson(
      res,
      200,
      getBillingStatus({
        org,
        billingMode: clients.config.mode,
        entitlements: runtime.entitlements,
        catalog: runtime.catalog,
        cuStore: runtime.cuStore,
      }),
    );
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/checkout") {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as {
      orgId?: string;
      planId?: string;
      customerEmail?: string;
    };
    if (!body.orgId || !body.planId) {
      sendJson(res, 400, { error: "MISSING_FIELDS", message: "orgId and planId required" });
      return;
    }
    const org = ensureOrg(runtime, body.orgId);
    const result = await createCheckoutSession(
      clients,
      {
        orgId: org.id,
        planId: body.planId as never,
        customerEmail: body.customerEmail,
        stripeCustomerId: org.stripeCustomerId,
      },
      runtime.catalog,
      runtime.env,
    );
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/portal") {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as { orgId?: string };
    if (!body.orgId) {
      sendJson(res, 400, { error: "MISSING_FIELDS", message: "orgId required" });
      return;
    }
    const org = ensureOrg(runtime, body.orgId);
    const result = await createCustomerPortalSession(clients, org.stripeCustomerId);
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (method === "POST" && url.pathname === "/v1/billing/webhooks/stripe") {
    const raw = await readBody(req);
    const signature = req.headers["stripe-signature"];
    const sig = Array.isArray(signature) ? signature[0] : signature;
    const result = await handleStripeWebhook(
      {
        clients,
        orgStore: runtime.orgStore,
        eventStore: runtime.eventStore,
        catalog: runtime.catalog,
      },
      raw,
      sig,
      runtime.env,
    );
    sendJson(res, result.ok ? 200 : 400, result);
    return;
  }

  if (method === "POST" && url.pathname === "/v1/entitlements/check") {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as {
      orgId?: string;
      entitlement?: EntitlementKey;
    };
    if (!body.orgId || !body.entitlement) {
      sendJson(res, 400, {
        error: "MISSING_FIELDS",
        message: "orgId and entitlement required",
      });
      return;
    }
    const org = ensureOrg(runtime, body.orgId);
    // Server-side only — ignore any client-supplied planId
    const allowed = runtime.entitlements.hasEntitlement(org, body.entitlement);
    const required = runtime.entitlements.requireEntitlement(org, body.entitlement);
    sendJson(res, 200, {
      allowed,
      entitlement: body.entitlement,
      effectivePlanId: runtime.entitlements.getPlanId(org),
      ...(allowed
        ? {}
        : {
            error: "ENTITLEMENT_REQUIRED",
            message: !required.ok ? required.message : undefined,
          }),
    });
    return;
  }

  if (method === "POST" && url.pathname === "/v1/features/managed-supercharger") {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as { orgId?: string };
    const org = ensureOrg(runtime, body.orgId ?? "org_demo");
    const gate = gateManagedSupercharger(runtime.entitlements, org);
    sendJson(res, gate.ok ? 200 : 402, gate);
    return;
  }

  if (method === "POST" && url.pathname === "/v1/features/cloud-history") {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as { orgId?: string };
    const org = ensureOrg(runtime, body.orgId ?? "org_demo");
    const gate = gateCloudHistory(runtime.entitlements, org);
    sendJson(res, gate.ok ? 200 : 402, gate);
    return;
  }

  if (method === "POST" && url.pathname === "/v1/features/scheduled-verify") {
    const raw = await readBody(req);
    const body = JSON.parse(raw.toString("utf8") || "{}") as { orgId?: string };
    const org = ensureOrg(runtime, body.orgId ?? "org_demo");
    const gate = gateScheduledVerification(runtime.entitlements, org);
    sendJson(res, gate.ok ? 200 : 402, gate);
    return;
  }

  if (method === "GET" && url.pathname === "/openapi.json") {
    const { openApiSpec } = await import("./openapi.js");
    sendJson(res, 200, openApiSpec);
    return;
  }

  sendJson(res, 404, { error: "NOT_FOUND", path: url.pathname });
}

export function startApiServer(
  runtime: ApiRuntime = createApiRuntime(),
  options: { port?: number; host?: string } = {},
): Promise<{ port: number; close: () => Promise<void> }> {
  const port = options.port ?? Number(process.env.PORT ?? 8787);
  const host = options.host ?? "0.0.0.0";

  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      void handleApiRequest(runtime, req, res).catch((err) => {
        sendJson(res, 500, {
          error: "INTERNAL",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    });
    server.on("error", reject);
    server.listen(port, host, () => {
      resolve({
        port,
        close: () =>
          new Promise((resClose, rejClose) => {
            server.close((err) => (err ? rejClose(err) : resClose()));
          }),
      });
    });
  });
}

export { createBillingClients, createEntitlementService };
