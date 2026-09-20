/**
 * Cloudflare RuntimeAdapter implementations wrapping execution targets.
 */

import type { RuntimeAdapter } from "../types.js";
import type { ExecutionContext } from "../../execution/types.js";
import { LocalExecutionTarget } from "../../execution/local.js";
import { RemoteCloudflareExecutionTarget } from "../../execution/remote.js";
import { PreviewExecutionTarget } from "../../execution/preview.js";
import type { ParityTest } from "../../trace/schema.js";
import { CLOUDFLARE_ADAPTER_ID } from "../types.js";
import { detectCloudflareAuth } from "./auth.js";

export class CloudflareLocalAdapter implements RuntimeAdapter {
  readonly id = `${CLOUDFLARE_ADAPTER_ID}-local`;
  readonly displayName = "Cloudflare Workers (local workerd)";
  readonly kind = "local" as const;
  private target: LocalExecutionTarget;

  constructor(ctx: ExecutionContext) {
    this.target = new LocalExecutionTarget(ctx);
  }

  async isAvailable() {
    return { available: true };
  }

  async prepare() {
    await this.target.prepare();
  }

  async execute(test: ParityTest) {
    return this.target.execute(test);
  }

  async cleanup() {
    await this.target.cleanup();
  }
}

export class CloudflareRemoteAdapter implements RuntimeAdapter {
  readonly id = `${CLOUDFLARE_ADAPTER_ID}-remote`;
  readonly displayName = "Cloudflare Workers (remote)";
  readonly kind = "remote" as const;
  private target: RemoteCloudflareExecutionTarget;

  constructor(ctx: ExecutionContext) {
    this.target = new RemoteCloudflareExecutionTarget(ctx);
  }

  async isAvailable() {
    const auth = detectCloudflareAuth();
    if (!auth.configured) {
      return {
        available: false,
        reason: "REMOTE_NOT_CONFIGURED: " + auth.label,
      };
    }
    return { available: true };
  }

  async prepare() {
    await this.target.prepare();
  }

  async execute(test: ParityTest) {
    return this.target.execute(test);
  }

  async cleanup() {
    await this.target.cleanup();
  }

  getPrepareStatus() {
    return this.target.getPrepareStatus();
  }
}

export class CloudflarePreviewAdapter implements RuntimeAdapter {
  readonly id = `${CLOUDFLARE_ADAPTER_ID}-preview`;
  readonly displayName = "Cloudflare Workers (preview)";
  readonly kind = "preview" as const;
  private target: PreviewExecutionTarget;

  constructor(ctx: ExecutionContext, opts: { existingUrl?: string } = {}) {
    this.target = new PreviewExecutionTarget(ctx, opts);
  }

  async isAvailable() {
    const auth = detectCloudflareAuth();
    if (!auth.configured) {
      return {
        available: false,
        reason: "REMOTE_NOT_CONFIGURED: " + auth.label,
      };
    }
    return { available: true };
  }

  async prepare() {
    await this.target.prepare();
  }

  async execute(test: ParityTest) {
    return this.target.execute(test);
  }

  async cleanup() {
    await this.target.cleanup();
  }

  getPrepareStatus() {
    return this.target.getPrepareStatus();
  }
}
