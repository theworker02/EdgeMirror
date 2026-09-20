/**
 * Preview URL execution — wrangler versions upload / workers.dev preview.
 * When credentials are missing, returns REMOTE_NOT_CONFIGURED honestly.
 *
 * New Workers cannot use `versions upload` until first deploy. On that
 * Wrangler error we fall back to an isolated throwaway `deploy` (same honesty
 * as remote execution) and use the workers.dev URL.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
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
  claimResource,
  type OwnedResource,
} from "../cleanup/ownership.js";
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
    output.match(/Version preview[:\s]+(https:\/\/\S+)/i) ??
    output.match(/Published\s+(https:\/\/\S+)/i);
  return match?.[1] ?? match?.[0];
}

function needsInitialDeploy(output: string): boolean {
  return /does not yet exist|run the `deploy` command first/i.test(output);
}

/** Keep paths intact; only rename so Wrangler resolves `main` from project root. */
function rewriteWorkerNameJsonc(source: string, name: string): string {
  let next = source;
  if (/"name"\s*:/.test(next)) {
    next = next.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${name}"`);
  } else {
    next = next.replace(/\{/, `{\n  "name": "${name}",`);
  }
  if (/"workers_dev"\s*:/.test(next)) {
    next = next.replace(/"workers_dev"\s*:\s*(true|false)/, `"workers_dev": true`);
  } else {
    next = next.replace(/\{/, `{\n  "workers_dev": true,`);
  }
  return next;
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
  private owned: OwnedResource[] = [];
  private workerName?: string;

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

    // Prefer versions upload for preview URLs when the Worker already exists.
    const upload = await runWrangler(
      ["versions", "upload", "--config", this.ctx.wranglerConfigPath],
      this.ctx.projectRoot,
    );

    if (upload.code === 0) {
      const url = parsePreviewUrl(upload.stdout + upload.stderr);
      if (url) {
        this.baseUrl = url.replace(/\/$/, "");
        this.configured = true;
        return;
      }
      this.configured = false;
      this.notConfiguredReason =
        "PREVIEW_NOT_AVAILABLE: Wrangler versions upload succeeded but no preview URL was found in output.";
      return;
    }

    const uploadOut = upload.stdout + upload.stderr;
    if (needsInitialDeploy(uploadOut)) {
      const ok = await this.deployThrowaway();
      if (ok) return;
      return;
    }

    const classified = classifyInfraFailure("PREVIEW_NOT_AVAILABLE\n" + uploadOut);
    this.configured = false;
    this.notConfiguredReason = [
      formatInfraFailureReport(classified),
      "",
      uploadOut.trim().slice(0, 1500) || "Wrangler versions upload failed.",
      "",
      "Ensure CLOUDFLARE_API_TOKEN has Workers Scripts:Edit and account access,",
      "or run `npx wrangler login`.",
    ].join("\n");
  }

  /** First-time Worker: deploy an isolated throwaway name, then use workers.dev. */
  private async deployThrowaway(): Promise<boolean> {
    const suffix = randomBytes(4).toString("hex");
    this.workerName = `edgemirror-tmp-${suffix}`;
    // Overlay must live in projectRoot so relative `main` paths resolve.
    mkdirSync(this.ctx.ownershipDir, { recursive: true });
    const overlayPath = join(
      this.ctx.projectRoot,
      `.edgemirror-tmp-${suffix}.wrangler.jsonc`,
    );

    if (!existsSync(this.ctx.wranglerConfigPath)) {
      this.configured = false;
      this.notConfiguredReason =
        "PREVIEW_NOT_AVAILABLE: wrangler config missing for throwaway deploy.";
      return false;
    }

    const original = readFileSync(this.ctx.wranglerConfigPath, "utf8");
    if (
      this.ctx.wranglerConfigPath.endsWith(".json") ||
      this.ctx.wranglerConfigPath.endsWith(".jsonc")
    ) {
      writeFileSync(
        overlayPath,
        rewriteWorkerNameJsonc(original, this.workerName),
        "utf8",
      );
    } else {
      const mainMatch = original.match(/^\s*main\s*=\s*"([^"]+)"/m);
      writeFileSync(
        overlayPath,
        JSON.stringify(
          {
            name: this.workerName,
            main: mainMatch?.[1] ?? "src/index.ts",
            compatibility_date:
              this.ctx.configurationFingerprint.compatibilityDate ??
              "2026-09-19",
            workers_dev: true,
          },
          null,
          2,
        ),
        "utf8",
      );
    }

    const deploy = await runWrangler(
      ["deploy", "--config", overlayPath, "--name", this.workerName],
      this.ctx.projectRoot,
    );
    if (deploy.code !== 0) {
      const out = deploy.stdout + deploy.stderr;
      const classified = classifyInfraFailure("PREVIEW_NOT_AVAILABLE\n" + out);
      this.configured = false;
      this.notConfiguredReason = [
        formatInfraFailureReport(classified),
        "",
        out.trim().slice(0, 1500) || "Wrangler deploy failed for preview fallback.",
      ].join("\n");
      return false;
    }

    const url = parsePreviewUrl(deploy.stdout + deploy.stderr);
    if (!url) {
      this.configured = false;
      this.notConfiguredReason =
        "PREVIEW_NOT_AVAILABLE: deploy succeeded but no workers.dev URL found.";
      return false;
    }

    this.baseUrl = url.replace(/\/$/, "");
    this.configured = true;
    try {
      this.owned.push(
        claimResource({
          ownershipDir: this.ctx.ownershipDir,
          type: "worker",
          name: this.workerName,
          metadata: {
            url: this.baseUrl,
            overlayPath,
            via: "preview-deploy-fallback",
          },
        }),
      );
    } catch {
      // Still configured — cleanup() deletes by workerName even without a marker.
    }
    return true;
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
    const names = new Set<string>();
    for (const resource of this.owned) {
      if (resource.type === "worker") names.add(resource.name);
    }
    if (this.workerName) names.add(this.workerName);
    for (const name of names) {
      await runWrangler(["delete", name, "--force"], this.ctx.projectRoot).catch(
        () => undefined,
      );
    }
    this.owned = [];
  }
}
