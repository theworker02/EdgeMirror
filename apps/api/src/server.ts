#!/usr/bin/env node
import { createApiRuntime, startApiServer } from "./index.js";

const runtime = createApiRuntime(process.env);
const port = Number(process.env.PORT ?? 8787);

const started = await startApiServer(runtime, { port, host: "0.0.0.0" });
console.log(
  JSON.stringify({
    service: "edgemirror-api",
    listening: `0.0.0.0:${started.port}`,
    billingMode:
      process.env.STRIPE_SECRET_KEY && process.env.EDGEMIRROR_BILLING_MODE !== "dry-run"
        ? "live"
        : process.env.STRIPE_SECRET_KEY
          ? "dry-run"
          : "BILLING_NOT_CONFIGURED",
  }),
);
