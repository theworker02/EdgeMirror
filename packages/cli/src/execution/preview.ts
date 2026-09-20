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
import { runWranglerSafe } from "../security/spawn.js";
import {
  assertAllowedPreviewUrl,
  resolveWorkerRequestUrl,
  UrlSafetyError,
} from "../security/url.js";
import {
  assertRequestBodySize,
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_MAX_RESPONSE_BYTES,
  truncateToBytes,
} from "../security/limits.js";

function hasCloudflareCredentials(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CLOUDFLARE_API_KEY ||
      process.env.CLOUDFLARE_EMAIL,
  );
}

function runWrangler(
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return runWranglerSafe(cwd, args);
}

function parsePreviewUrl(output: string): string | undefined {
  const match =
    output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev[^\s]*/i) ??
    output.match(/Preview\s+URL[:\s]+(https:\/\/\S+)/i) ??
    output.match(/Version preview[:\s]+(https:\/\/\S+)/i);
  const url = match?.[1] ?? match?.[0];
  if (!url) return undefined;
  try {
    return assertAllowedPreviewUrl(url);
  } catch {
    return undefined;
  }
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
  private notConfiguredReason =
    "REMOTE_NOT_CONFIGURED: Cloudflare credentials required for preview execution.";
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
      try {
        this.baseUrl = assertAllowedPreviewUrl(this.opts.existingUrl);
        this.configured = true;
      } catch (err) {
        this.configured = false;
        this.notConfiguredReason =
          err instanceof UrlSafetyError
            ? `PREVIEW_URL_REJECTED: ${err.message}`
            : "PREVIEW_URL_REJECTED: invalid preview URL";
      }
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
        this.notConfiguredReason =
          "REMOTE_NOT_CONFIGURED: Cloudflare authentication is unavailable for preview. " +
          "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or run `npx wrangler login`.";
        return;
      }
    }

    // Prefer versions upload for preview URLs when available.
    const upload = await runWrangler(
      ["versions", "upload", "--config", this.ctx.wranglerConfigPath],
      this.ctx.projectRoot,
    );

    if (upload.code !== 0) {
      this.configured = false;
      this.notConfiguredReason = [
        "PREVIEW_NOT_AVAILABLE",
        "",
        "Could not create a Cloudflare preview/version URL.",
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
        "PREVIEW_NOT_AVAILABLE: Wrangler versions upload succeeded but no allowed preview URL was found in output.";
      return;
    }

    this.baseUrl = url;
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

    try {
      assertRequestBodySize(test.request.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return createTrace({
        testId: test.id,
        target: "remote",
        status: "error",
        statusReason: message,
        configurationFingerprint: this.ctx.configurationFingerprint,
        observations: emptyObservations(),
        rawError: message,
      });
    }

    const url = resolveWorkerRequestUrl(this.baseUrl, test.request.path);
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
        signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
      });
      const rawBody = await res.text();
      const truncated = truncateToBytes(rawBody, DEFAULT_MAX_RESPONSE_BYTES);
      if (truncated.truncated) {
        observations.notes.push(
          `Response truncated at ${DEFAULT_MAX_RESPONSE_BYTES} bytes (was ${truncated.originalBytes})`,
        );
      }
      observations.http.status = captured(res.status);
      observations.http.headers = captured(headersFromFetch(res.headers));
      observations.http.body = captured(truncated.text);
      observations.http.bodyEncoding = captured(
        truncated.text.length === 0 ? "empty" : "utf8",
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
