/**
 * Fixture that embeds an environment marker so local vs remote can diverge
 * if ENVIRONMENT differs — useful for intentional divergence tests.
 */
export default {
  async fetch(request: Request, env: { MARKER?: string }): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.json({
        ok: true,
        marker: env.MARKER ?? "local-default",
      });
    }
    return new Response("Not Found", { status: 404 });
  },
};
