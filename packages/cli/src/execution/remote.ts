import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import type { ExecutionContext, ExecutionTarget } from "./types.js";
import { budgetExceeded } from "./types.js";
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

export interface RemotePrepareResult {
  configured: boolean;
  reason?: string;
  workerName?: string;
  workersDevUrl?: string;
}

function parseDeployUrl(output: string): string | undefined {
  const match =
    output.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/i) ??
    output.match(/Published\s+(https:\/\/\S+)/i);
  return match?.[1] ?? match?.[0];
}

/**
 * Remote Cloudflare execution target.
 * When credentials are unavailable, every execute() returns REMOTE_NOT_CONFIGURED.
 */
export class RemoteCloudflareExecutionTarget implements ExecutionTarget {
  readonly kind = "remote" as const;
  private configured = false;
  private notConfiguredReason = remoteNotConfiguredMessage("remote execution");
  private workerName?: string;
  private baseUrl?: string;
  private owned: OwnedResource[] = [];

  constructor(private readonly ctx: ExecutionContext) {}

  getPrepareStatus(): RemotePrepareResult {
    return {
      configured: this.configured,
      reason: this.configured ? undefined : this.notConfiguredReason,
      workerName: this.workerName,
      workersDevUrl: this.baseUrl,
    };
  }

  async prepare(): Promise<void> {
    if (!hasCloudflareCredentials()) {
      // Also try wrangler whoami — may work after interactive login.
      const whoami = await runWrangler(["whoami"], this.ctx.projectRoot);
      const authenticated =
        whoami.code === 0 &&
        !/not authenticated|not logged in|No account/i.test(
          whoami.stdout + whoami.stderr,
        );
      if (!authenticated) {
        this.configured = false;
        this.notConfiguredReason = remoteNotConfiguredMessage("remote execution");
        return;
      }
    }

    const suffix = randomBytes(4).toString("hex");
    this.workerName = `edgemirror-tmp-${suffix}`;

    // Create an isolated deploy overlay config that renames the worker.
    const overlayDir = join(this.ctx.ownershipDir, "remote-deploy");
    mkdirSync(overlayDir, { recursive: true });
    const original = readFileSync(this.ctx.wranglerConfigPath, "utf8");
    const overlayPath = join(overlayDir, "wrangler.jsonc");

    // Prefer JSON rewrite when source is JSON/JSONC.
    if (
      this.ctx.wranglerConfigPath.endsWith(".json") ||
      this.ctx.wranglerConfigPath.endsWith(".jsonc")
    ) {
      // Minimal safe rewrite: force name + workers_dev.
      const rewritten = rewriteWorkerNameJsonc(original, this.workerName);
      writeFileSync(overlayPath, rewritten, "utf8");
    } else {
      // For TOML, write a small JSONC wrapper referencing the same main via copy instructions.
      writeFileSync(
        overlayPath,
        JSON.stringify(
          {
            name: this.workerName,
            main: inferMainFromToml(original) ?? "src/index.ts",
            compatibility_date:
              this.ctx.configurationFingerprint.compatibilityDate ?? "2026-09-19",
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
      this.configured = false;
      this.notConfiguredReason = formatRemoteFailure(deploy.stdout + deploy.stderr);
      return;
    }

    const url = parseDeployUrl(deploy.stdout + deploy.stderr);
    if (!url) {
      this.configured = false;
      this.notConfiguredReason =
        "REMOTE EXECUTION FAILED\n\nWorker deploy appeared to succeed but no workers.dev URL was found in Wrangler output.";
      return;
    }

    this.baseUrl = url.replace(/\/$/, "");
    this.configured = true;

    const resource = claimResource({
      ownershipDir: this.ctx.ownershipDir,
      type: "worker",
      name: this.workerName,
      metadata: { url: this.baseUrl, overlayPath },
    });
    this.owned.push(resource);
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

    if (this.ctx.budget) {
      const exceeded = budgetExceeded(this.ctx.budget);
      if (exceeded) {
        return createTrace({
          testId: test.id,
          target: "remote",
          status: "BUDGET_EXCEEDED",
          statusReason: exceeded,
          configurationFingerprint: this.ctx.configurationFingerprint,
          observations: emptyObservations(),
        });
      }
      this.ctx.budget.runsUsed += 1;
    }

    const observations = emptyObservations();
    observations.runtime.runtimeName = captured("cloudflare-workers");
    observations.runtime.compatibilityDate = this.ctx.configurationFingerprint
      .compatibilityDate
      ? captured(this.ctx.configurationFingerprint.compatibilityDate)
      : unavailable("unset");
    observations.notes.push("Remote execution against isolated EdgeMirror temporary Worker");

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
      const durationMs = Date.now() - started;
      const bodyText = await res.text();
      observations.http.status = captured(res.status);
      observations.http.headers = captured(headersFromFetch(res.headers));
      observations.http.body = captured(bodyText);
      observations.http.bodyEncoding = captured(bodyText.length === 0 ? "empty" : "utf8");
      observations.durationMs = captured(durationMs);
      observations.exception = captured(null);
      observations.runtime.platformHints = captured({
        cfRay: res.headers.get("cf-ray") ?? undefined,
      });

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
    if (!this.configured || !this.workerName) return;
    const del = await runWrangler(
      ["delete", this.workerName, "--force"],
      this.ctx.projectRoot,
    );
    if (del.code === 0) {
      for (const resource of this.owned) {
        const marker = join(this.ctx.ownershipDir, `${resource.id}.json`);
        if (existsSync(marker)) {
          // mark cleaned
          const data = JSON.parse(readFileSync(marker, "utf8")) as OwnedResource;
          data.cleanedAt = new Date().toISOString();
          writeFileSync(marker, JSON.stringify(data, null, 2));
        }
      }
    }
  }
}

function rewriteWorkerNameJsonc(source: string, name: string): string {
  // If name exists, replace; else inject after opening brace.
  if (/"name"\s*:/.test(source)) {
    return source.replace(/"name"\s*:\s*"[^"]*"/, `"name": "${name}"`);
  }
  return source.replace(/\{/, `{\n  "name": "${name}",`);
}

function inferMainFromToml(toml: string): string | undefined {
  const m = toml.match(/^\s*main\s*=\s*"([^"]+)"/m);
  return m?.[1];
}

function formatRemoteFailure(output: string): string {
  const classified = classifyInfraFailure(output);
  return [
    formatInfraFailureReport(classified),
    "",
    "No remote resources were retained for this failed prepare.",
    "",
    output.trim().slice(0, 1500),
  ].join("\n");
}
