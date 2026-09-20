/**
 * Runner start hardening — authenticated local runner pool entrypoint.
 *
 * Security assumptions coordinated with Agent 3:
 * - Require EDGEMIRROR_RUNNER_TOKEN (or --token) before accepting work
 * - Bind to loopback by default
 * - Enforce CU / concurrency ceilings from governor
 * - Do not execute untrusted job payloads without token match
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { captureResources } from "./resources.js";
import { resolveGovernor } from "./governors.js";
import type { GovernorMode } from "./types.js";

export interface RunnerStartOptions {
  host?: string;
  port?: number;
  token?: string;
  mode?: GovernorMode;
  maxConcurrency?: number;
}

export interface RunnerHandle {
  host: string;
  port: number;
  url: string;
  close: () => Promise<void>;
}

function readToken(req: IncomingMessage): string | undefined {
  const h = req.headers["authorization"];
  if (typeof h === "string" && h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim();
  }
  const x = req.headers["x-edgemirror-runner-token"];
  return typeof x === "string" ? x : undefined;
}

export async function startRunner(
  options: RunnerStartOptions = {},
): Promise<RunnerHandle> {
  const token =
    options.token ??
    process.env.EDGEMIRROR_RUNNER_TOKEN ??
    process.env.EDGEMIRROR_RUNNER_AUTH;

  if (!token || token.length < 16) {
    throw new Error(
      "Runner start refused: set EDGEMIRROR_RUNNER_TOKEN to a secret ≥16 chars (Agent 3 auth assumption).",
    );
  }

  const host = options.host ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    if (process.env.EDGEMIRROR_RUNNER_ALLOW_NON_LOOPBACK !== "1") {
      throw new Error(
        "Runner start refused: non-loopback bind requires EDGEMIRROR_RUNNER_ALLOW_NON_LOOPBACK=1",
      );
    }
  }

  const mode = options.mode ?? "BALANCED";
  const governor = resolveGovernor(mode, {
    maxConcurrency: options.maxConcurrency,
  });
  const resources = captureResources({ mode });

  let active = 0;

  const server = createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const presented = readToken(req);
    if (!presented || presented !== token) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "unauthorized",
          hint: "Provide Authorization: Bearer <EDGEMIRROR_RUNNER_TOKEN>",
        }),
      );
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          ok: true,
          active,
          governor,
          resources: {
            cpus: resources.cpus,
            recommendedConcurrency: resources.recommendedConcurrency,
          },
          note: "Runner health — not a verification evidence endpoint",
        }),
      );
      return;
    }

    if (req.method === "POST" && req.url === "/v1/jobs") {
      if (active >= governor.maxConcurrency) {
        res.statusCode = 429;
        res.end(JSON.stringify({ error: "concurrency ceiling reached" }));
        return;
      }
      // Accept envelope only — do not execute arbitrary code in this hardening stub.
      const body = await readBody(req);
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "invalid JSON" }));
        return;
      }
      active += 1;
      try {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            accepted: true,
            job: parsed,
            note:
              "Job envelope accepted. Execution plane remains EdgeMirror orchestrator — runner does not eval payloads.",
          }),
        );
      } finally {
        active -= 1;
      }
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  };

  const port = options.port ?? 0;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const addr = server.address();
  const boundPort =
    addr && typeof addr === "object" ? addr.port : (options.port ?? 0);

  return {
    host,
    port: boundPort,
    url: `http://${host}:${boundPort}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > 1_000_000) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
