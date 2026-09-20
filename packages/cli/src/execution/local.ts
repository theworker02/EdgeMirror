import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import type { ExecutionContext, ExecutionTarget } from "./types.js";
import type { ParityTest } from "../trace/schema.js";
import {
  captured,
  createTrace,
  emptyObservations,
  headersFromFetch,
  unavailable,
} from "../trace/factory.js";

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close();
        reject(new Error("Could not allocate free port"));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function resolveWranglerBin(): { cmd: string; argsPrefix: string[] } {
  // Prefer local workspace wrangler via npx.
  return { cmd: process.platform === "win32" ? "npx.cmd" : "npx", argsPrefix: ["wrangler"] };
}

export class LocalExecutionTarget implements ExecutionTarget {
  readonly kind = "local" as const;
  private port?: number;
  private child?: ChildProcess;
  private baseUrl?: string;
  private ready = false;
  private stderr = "";
  private stdout = "";

  constructor(private readonly ctx: ExecutionContext) {}

  async prepare(): Promise<void> {
    this.port = await getFreePort();
    this.baseUrl = `http://127.0.0.1:${this.port}`;
    const { cmd, argsPrefix } = resolveWranglerBin();
    const args = [
      ...argsPrefix,
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(this.port),
      "--config",
      this.ctx.wranglerConfigPath,
    ];
    if (this.ctx.compatibilityDateOverride) {
      // Wrangler does not always accept CLI override; documented for future.
      // Compatibility date override is applied via temporary config in orchestrator when needed.
    }

    this.child = spawn(cmd, args, {
      cwd: this.ctx.projectRoot,
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: "false",
        CI: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: process.platform === "win32",
    });

    this.child.stdout?.on("data", (chunk: Buffer) => {
      this.stdout += chunk.toString("utf8");
    });
    this.child.stderr?.on("data", (chunk: Buffer) => {
      this.stderr += chunk.toString("utf8");
    });

    const deadline = Date.now() + 60_000;
    let delayMs = 100;
    while (Date.now() < deadline) {
      if (this.child.exitCode !== null) {
        throw new Error(
          `Local wrangler dev exited early (code ${this.child.exitCode}).\n${this.stderr || this.stdout}`,
        );
      }
      try {
        const res = await fetch(this.baseUrl!, {
          method: "GET",
          signal: AbortSignal.timeout(2000),
        });
        // Any HTTP response means the server is up (even 404).
        if (res.status >= 100) {
          this.ready = true;
          return;
        }
      } catch {
        // still starting
      }
      // Also detect ready banners
      if (/Ready on|Local:|http:\/\/127\.0\.0\.1/i.test(this.stdout + this.stderr)) {
        // give it a moment then probe again
        await delay(Math.min(delayMs, 300));
        try {
          await fetch(this.baseUrl!, {
            method: "GET",
            signal: AbortSignal.timeout(2000),
          });
          this.ready = true;
          return;
        } catch {
          /* continue */
        }
      }
      await delay(delayMs);
      delayMs = Math.min(1000, Math.floor(delayMs * 1.4));
    }
    throw new Error(
      `Timed out waiting for local wrangler dev on port ${this.port}.\n${this.stderr || this.stdout}`,
    );
  }

  async execute(test: ParityTest) {
    if (!this.ready || !this.baseUrl) {
      throw new Error("LocalExecutionTarget.prepare() must be called first");
    }

    const observations = emptyObservations();
    observations.runtime.runtimeName = captured("workerd");
    observations.runtime.wranglerVersion = unavailable("captured via doctor fingerprint");
    observations.runtime.compatibilityDate = this.ctx.configurationFingerprint.compatibilityDate
      ? captured(this.ctx.configurationFingerprint.compatibilityDate)
      : unavailable("unset");
    observations.runtime.compatibilityFlags = captured(
      this.ctx.configurationFingerprint.compatibilityFlags,
    );
    observations.notes.push("Local execution via `wrangler dev --local`");

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

      return createTrace({
        testId: test.id,
        target: "local",
        status: "ok",
        configurationFingerprint: this.ctx.configurationFingerprint,
        observations,
      });
    } catch (err) {
      const durationMs = Date.now() - started;
      observations.durationMs = captured(durationMs);
      const message = err instanceof Error ? err.message : String(err);
      observations.exception = captured({
        name: err instanceof Error ? err.name : "Error",
        message,
        stack: err instanceof Error ? err.stack : undefined,
      });
      observations.http.status = unavailable("request failed");
      observations.http.headers = unavailable("request failed");
      observations.http.body = unavailable("request failed");
      observations.http.bodyEncoding = unavailable("request failed");
      return createTrace({
        testId: test.id,
        target: "local",
        status: "error",
        statusReason: message,
        configurationFingerprint: this.ctx.configurationFingerprint,
        observations,
        rawError: message,
      });
    }
  }

  async cleanup(): Promise<void> {
    if (!this.child) return;
    const child = this.child;
    this.child = undefined;
    this.ready = false;
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
            stdio: "ignore",
            windowsHide: true,
          }).once("exit", done);
        } else {
          child.kill("SIGTERM");
          setTimeout(() => {
            if (child.exitCode === null) child.kill("SIGKILL");
          }, 3000);
        }
      } catch {
        done();
      }
      setTimeout(done, 5000);
    });
  }
}
