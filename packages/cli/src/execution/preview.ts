/**
 * Preview URL execution — wrangler versions upload / workers.dev preview.
 * When credentials are missing, returns REMOTE_NOT_CONFIGURED honestly.
 */

import type { ExecutionContext, ExecutionTarget } from "./types.js";
import type { ParityTest } from "../trace/schema.js";
import {
  captured,
  createTrace,
  emptyObservations,
  headersFromFetch,
  unavailable,
} from "../trace/factory.js";
import {
  hasCloudflareCredentials,
  remoteNotConfiguredMessage,
} from "../adapters/cloudflare/auth.js";
import { runWrangler } from "../adapters/cloudflare/wrangler.js";
import {
  classifyInfraFailure,
  formatInfraFailureReport,
} from "../adapters/cloudflare/failures.js";

function parsePreviewUrl(output: string): string | undefined {
  const match =
    output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev[^\s]*/i) ??
    output.match(/Preview\s+URL[:\s]+(https:\/\/\S+)/i) ??
    output.match(/Version preview[:\s]+(https:\/\/\S+)/i);
  return match?.[1] ?? match?.[0];
}

export interface PreviewPrepareResult {
  configured: boolean;
  reason?: string;
  previewUrl?: string;
}

/**
 * Executes against a Cloudflare preview/version URL.
 * Does not invent results when auth or preview creation fails.
 */
export class PreviewExecutionTarget implements ExecutionTarget {
  readonly kind = "remote" as const;
  private configured = false;
  private notConfiguredReason = remoteNotConfiguredMessage("preview execution");
  private baseUrl?: string;

  constructor(
    private readonly ctx: ExecutionContext,
    private readonly opts: { existingUrl?: string } = {},
  ) {}

  getPrepareStatus(): PreviewPrepareResult {
    return {
      configured: this.configured,
      reason: this.configured ? undefined : this.notConfiguredReason,
      previewUrl: this.baseUrl,
    };
  }

  async prepare(): Promise<void> {
    if (this.opts.existingUrl) {
      this.baseUrl = this.opts.existingUrl.replace(/\/$/, "");
      this.configured = true;
      return;
    }

    if (!hasCloudflareCredentials()) {
      const whoami = await runWrangler(["whoami"], this.ctx.projectRoot);
      const authenticated =
        whoami.code === 0 &&
        !/not authenticated|not logged in|No account/i.test(
          whoami.stdout + whoami.stderr,
        );
      if (!authenticated) {
        this.configured = false;
        this.notConfiguredReason = remoteNotConfiguredMessage("preview execution");
        return;
      }
    }

    // Prefer versions upload for preview URLs when available.
    const upload = await runWrangler(
      [
        "versions",
        "upload",
        "--config",
        this.ctx.wranglerConfigPath,
      ],
      this.ctx.projectRoot,
    );

    if (upload.code !== 0) {
      const classified = classifyInfraFailure(
        "PREVIEW_NOT_AVAILABLE\n" + upload.stdout + upload.stderr,
      );
      this.configured = false;
      this.notConfiguredReason = [
        formatInfraFailureReport(classified),
        "",
        (upload.stdout + upload.stderr).trim().slice(0, 1500) ||
          "Wrangler versions upload failed.",
        "",
        "Ensure CLOUDFLARE_API_TOKEN has Workers Scripts:Edit and account access.",
      ].join("\n");
      return;
    }

    const url = parsePreviewUrl(upload.stdout + upload.stderr);
    if (!url) {
      this.configured = false;
      this.notConfiguredReason =
        "PREVIEW_NOT_AVAILABLE: Wrangler versions upload succeeded but no preview URL was found in output.";
      return;
    }

    this.baseUrl = url.replace(/\/$/, "");
    this.configured = true;
  }

  async execute(test: ParityTest) {
    if (!this.configured || !this.baseUrl) {
      return createTrace({
        testId: test.id,
        target: "remote",
        status: "REMOTE_NOT_CONFIGURED",
        statusReason: this.notConfiguredReason,
        configurationFingerprint: this.ctx.configurationFingerprint,
        observations: emptyObservations(),
      });
    }

    const observations = emptyObservations();
    observations.runtime.runtimeName = captured("cloudflare-preview");
    observations.runtime.compatibilityDate = this.ctx.configurationFingerprint
      .compatibilityDate
      ? captured(this.ctx.configurationFingerprint.compatibilityDate)
      : unavailable("unset");
    observations.notes.push("Preview execution against Cloudflare preview/version URL");

    const url = new URL(test.request.path, this.baseUrl);
    const started = Date.now();
    try {
      const res = await fetch(url, {
        method: test.request.method,
        headers: test.request.headers,
        body:
          test.request.body !== undefined &&
          test.request.method !== "GET" &&
          test.request.method !== "HEAD"
            ? test.request.body
            : undefined,
        signal: AbortSignal.timeout(30_000),
      });
      const bodyText = await res.text();
      observations.http.status = captured(res.status);
      observations.http.headers = captured(headersFromFetch(res.headers));
      observations.http.body = captured(bodyText);
      observations.http.bodyEncoding = captured(
        bodyText.length === 0 ? "empty" : "utf8",
      );
      observations.durationMs = captured(Date.now() - started);
      observations.exception = captured(null);
      return createTrace({
        testId: test.id,
        target: "remote",
        status: "ok",
        configurationFingerprint: this.ctx.configurationFingerprint,
        observations,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      observations.durationMs = captured(Date.now() - started);
      observations.exception = captured({
        name: err instanceof Error ? err.name : "Error",
        message,
        stack: err instanceof Error ? err.stack : undefined,
      });
      return createTrace({
        testId: test.id,
        target: "remote",
        status: "error",
        statusReason: message,
        configurationFingerprint: this.ctx.configurationFingerprint,
        observations,
        rawError: message,
      });
    }
  }

  async cleanup(): Promise<void> {
    // Preview versions are ephemeral; no forced delete required for v1.
  }
}
