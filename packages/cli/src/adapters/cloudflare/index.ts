/**
 * Cloudflare adapter barrel + BindingAdapter for wrangler configs.
 */

export { CLOUDFLARE_ADAPTER_ID } from "../types.js";
export * from "./auth.js";
export * from "./bindings.js";
export * from "./failures.js";
export * from "./support-report.js";
export * from "./wrangler.js";
export * from "./runtime.js";

import type { BindingAdapter } from "../types.js";
import { summarizeBindings, type WranglerConfig } from "../../discovery/index.js";
import { CLOUDFLARE_BINDING_SUPPORT } from "./bindings.js";

export class CloudflareBindingAdapter implements BindingAdapter {
  readonly id = "cloudflare-bindings";
  readonly bindingType = "cloudflare-workers";

  summarize(config: unknown): Record<string, unknown> {
    const cfg = config as WranglerConfig;
    const counts = summarizeBindings(cfg);
    const present = CLOUDFLARE_BINDING_SUPPORT.filter((b) => {
      if (b.wranglerKeys.length === 0) return false;
      return b.wranglerKeys.some((k) => {
        const v = (cfg as Record<string, unknown>)[k];
        if (v == null) return false;
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === "object") return Object.keys(v).length > 0;
        return true;
      });
    }).map((b) => ({
      id: b.id,
      name: b.name,
      discovery: b.discovery,
      parity: b.parity,
    }));
    return { counts, present, catalogVersion: "1.0" };
  }
}
