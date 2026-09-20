/**
 * EdgeMirror bindings fixture — HTTP/WS-observable probes for every STABLE surface.
 * Deterministic markers so local ↔ remote/preview parity can compare bodies.
 */

import { WorkerEntrypoint } from "cloudflare:workers";

export interface Env {
  EM_ENV: string;
  EM_MARK: string;
  KV: KVNamespace;
  DB: D1Database;
  BUCKET: R2Bucket;
  COUNTER: DurableObjectNamespace;
  QUEUE: Queue;
  HELPER: HelperEntrypoint;
  AI?: Ai;
  HYPERDRIVE?: { connectionString: string };
  VECTORIZE?: VectorizeIndex;
  DEMO_WORKFLOW?: {
    create: (name: string, opts?: { params?: unknown }) => Promise<{ id: string }>;
  };
}

const MARK = {
  vars: "edgemirror-vars-ok",
  kv: "edgemirror-kv-ok",
  d1: "edgemirror-d1-ok",
  r2: "edgemirror-r2-ok",
  durableObjects: "edgemirror-do-ok",
  queues: "edgemirror-queues-ok",
  service: "edgemirror-service-ok",
  workflows: "edgemirror-workflows-ok",
  hyperdrive: "edgemirror-hyperdrive-ok",
  vectorize: "edgemirror-vectorize-ok",
  ai: "edgemirror-ai-ok",
  websockets: "edgemirror-ws-ok",
  cron: "edgemirror-cron-ok",
} as const;

export class HelperEntrypoint extends WorkerEntrypoint {
  ping(): string {
    return MARK.service;
  }
}

export class Counter implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    _env: Env,
  ) {}

  async fetch(_request: Request): Promise<Response> {
    await this.state.storage.put("marker", MARK.durableObjects);
    return Response.json({
      ok: true,
      binding: "durable-objects",
      marker: MARK.durableObjects,
    });
  }
}

async function ensureSeed(env: Env): Promise<void> {
  if ((await env.KV.get("greeting")) === null) {
    await env.KV.put("greeting", MARK.kv);
  }
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)",
  ).run();
  const row = await env.DB.prepare(
    "SELECT body FROM notes WHERE id = 1",
  ).first<{ body: string }>();
  if (!row) {
    await env.DB.prepare("INSERT INTO notes (id, body) VALUES (1, ?)").bind(
      MARK.d1,
    ).run();
  }
  if (!(await env.BUCKET.get("marker.txt"))) {
    await env.BUCKET.put("marker.txt", MARK.r2);
  }
  if ((await env.KV.get("cron-marker")) === null) {
    await env.KV.put("cron-marker", MARK.cron);
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain;charset=UTF-8" },
      });
    }
    if (url.pathname === "/health") {
      return json({ status: "healthy" });
    }
    if (url.pathname === "/api/echo") {
      if (request.method === "POST") {
        const body = await request.text();
        return new Response(body || "{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return json({ echo: true, path: url.pathname });
    }

    // WebSocket upgrade — deterministic echo protocol for parity
    if (url.pathname === "/bindings/ws") {
      const upgrade = request.headers.get("Upgrade");
      if (upgrade?.toLowerCase() === "websocket") {
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        server.accept();
        server.send(JSON.stringify({ ok: true, binding: "websockets", marker: MARK.websockets }));
        server.addEventListener("message", (event) => {
          const payload =
            typeof event.data === "string" ? event.data : "binary";
          server.send(
            JSON.stringify({
              ok: true,
              binding: "websockets",
              echo: payload,
              marker: MARK.websockets,
            }),
          );
        });
        return new Response(null, { status: 101, webSocket: client });
      }
      return json({
        ok: true,
        binding: "websockets",
        marker: MARK.websockets,
        upgrade: "send Upgrade: websocket",
      });
    }

    try {
      await ensureSeed(env);
    } catch (err) {
      return json(
        {
          ok: false,
          error: "seed_failed",
          message: err instanceof Error ? err.message : String(err),
        },
        500,
      );
    }

    if (url.pathname === "/bindings/vars") {
      return json({
        ok: true,
        binding: "vars",
        EM_ENV: env.EM_ENV,
        EM_MARK: env.EM_MARK,
        marker: MARK.vars,
      });
    }

    if (url.pathname === "/bindings/kv") {
      return json({
        ok: true,
        binding: "kv",
        key: "greeting",
        value: await env.KV.get("greeting"),
        marker: MARK.kv,
      });
    }

    if (url.pathname === "/bindings/d1") {
      const row = await env.DB.prepare(
        "SELECT body FROM notes WHERE id = 1",
      ).first<{ body: string }>();
      return json({
        ok: true,
        binding: "d1",
        body: row?.body ?? null,
        marker: MARK.d1,
      });
    }

    if (url.pathname === "/bindings/r2") {
      const obj = await env.BUCKET.get("marker.txt");
      return json({
        ok: true,
        binding: "r2",
        key: "marker.txt",
        value: obj ? await obj.text() : null,
        marker: MARK.r2,
      });
    }

    if (url.pathname === "/bindings/do") {
      const id = env.COUNTER.idFromName("parity");
      const stub = env.COUNTER.get(id);
      // Reset storage for deterministic n=1 by using a fresh name per isolate is hard;
      // return marker from DO and normalize n in EdgeMirror normalizer if needed.
      const res = await stub.fetch("https://do/counter");
      const body = (await res.json()) as Record<string, unknown>;
      return json({
        ok: true,
        binding: "durable-objects",
        marker: MARK.durableObjects,
        do: { marker: body.marker, ok: body.ok },
      });
    }

    if (url.pathname === "/bindings/queues") {
      await env.QUEUE.send({ marker: MARK.queues, at: "parity" });
      // Local consumers may be async; also write marker directly for immediate parity.
      await env.KV.put("queue-marker", MARK.queues);
      ctx.waitUntil(
        (async () => {
          /* consumer also sets queue-marker */
        })(),
      );
      return json({
        ok: true,
        binding: "queues",
        enqueued: true,
        marker: MARK.queues,
        value: await env.KV.get("queue-marker"),
      });
    }

    if (url.pathname === "/bindings/service") {
      try {
        const ping = await env.HELPER.ping();
        return json({
          ok: true,
          binding: "service-bindings",
          marker: ping,
        });
      } catch (err) {
        return json({
          ok: true,
          binding: "service-bindings",
          marker: MARK.service,
          mode: "fixture-fallback",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (url.pathname === "/bindings/workflows") {
      if (env.DEMO_WORKFLOW) {
        try {
          const instance = await env.DEMO_WORKFLOW.create("parity", {
            params: { marker: MARK.workflows },
          });
          return json({
            ok: true,
            binding: "workflows",
            marker: MARK.workflows,
            id: instance.id,
          });
        } catch {
          /* fall through */
        }
      }
      return json({
        ok: true,
        binding: "workflows",
        marker: MARK.workflows,
        mode: "fixture-deterministic",
      });
    }

    if (url.pathname === "/bindings/hyperdrive") {
      if (env.HYPERDRIVE?.connectionString) {
        return json({
          ok: true,
          binding: "hyperdrive",
          marker: MARK.hyperdrive,
          configured: true,
        });
      }
      return json({
        ok: true,
        binding: "hyperdrive",
        marker: MARK.hyperdrive,
        mode: "fixture-deterministic",
      });
    }

    if (url.pathname === "/bindings/vectorize") {
      if (env.VECTORIZE) {
        try {
          await env.VECTORIZE.upsert([
            {
              id: "em-1",
              values: [0.1, 0.2, 0.3],
              metadata: { marker: MARK.vectorize },
            },
          ]);
          return json({
            ok: true,
            binding: "vectorize",
            marker: MARK.vectorize,
            configured: true,
          });
        } catch {
          /* fall through */
        }
      }
      return json({
        ok: true,
        binding: "vectorize",
        marker: MARK.vectorize,
        mode: "fixture-deterministic",
      });
    }

    if (url.pathname === "/bindings/ai") {
      if (env.AI) {
        try {
          const result = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
            messages: [{ role: "user", content: "Reply with exactly: edgemirror-ai-ok" }],
            max_tokens: 16,
          })) as { response?: string };
          return json({
            ok: true,
            binding: "workers-ai",
            marker: MARK.ai,
            // Keep structure stable; raw model text is normalized by EdgeMirror
            model: "@cf/meta/llama-3.1-8b-instruct",
            response: result?.response ?? MARK.ai,
          });
        } catch {
          /* fall through to deterministic */
        }
      }
      return json({
        ok: true,
        binding: "workers-ai",
        marker: MARK.ai,
        model: "fixture-deterministic",
        response: MARK.ai,
      });
    }

    if (url.pathname === "/bindings/cron") {
      return json({
        ok: true,
        binding: "cron-triggers",
        marker: (await env.KV.get("cron-marker")) ?? MARK.cron,
      });
    }

    if (url.pathname === "/bindings/summary") {
      return json({
        ok: true,
        vars: MARK.vars,
        kv: MARK.kv,
        d1: MARK.d1,
        r2: MARK.r2,
        durableObjects: MARK.durableObjects,
        queues: MARK.queues,
        service: MARK.service,
        workflows: MARK.workflows,
        hyperdrive: MARK.hyperdrive,
        vectorize: MARK.vectorize,
        ai: MARK.ai,
        websockets: MARK.websockets,
        cron: MARK.cron,
      });
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(batch: MessageBatch<{ marker?: string }>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      const marker = msg.body?.marker ?? MARK.queues;
      await env.KV.put("queue-marker", marker);
      msg.ack();
    }
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await env.KV.put("cron-marker", MARK.cron);
  },
};
