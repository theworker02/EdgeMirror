export interface Env {}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response("ok", {
        status: 200,
        headers: { "content-type": "text/plain;charset=UTF-8" },
      });
    }

    if (url.pathname === "/health") {
      return Response.json({ status: "healthy" });
    }

    if (url.pathname === "/api/echo") {
      if (request.method === "POST") {
        const body = await request.text();
        return new Response(body || "{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return Response.json({ echo: true, path: url.pathname });
    }

    if (url.pathname === "/api/nondeterministic") {
      return Response.json({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
