import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { PreviewExecutionTarget } from "../src/execution/preview.js";
import { RemoteCloudflareExecutionTarget } from "../src/execution/remote.js";
import { createFingerprint, emptyBindingSummary } from "../src/trace/factory.js";

function ctx(projectRoot: string) {
  return {
    projectRoot,
    wranglerConfigPath: join(projectRoot, "wrangler.jsonc"),
    configurationFingerprint: createFingerprint({
      projectRoot,
      compatibilityFlags: [],
      bindings: emptyBindingSummary(),
    }),
    ownershipDir: join(projectRoot, ".edgemirror", "ownership"),
  };
}

describe("remote/preview without credentials", () => {
  it("remote prepare yields REMOTE_NOT_CONFIGURED execute status", async () => {
    const prevToken = process.env.CLOUDFLARE_API_TOKEN;
    const prevKey = process.env.CLOUDFLARE_API_KEY;
    const prevEmail = process.env.CLOUDFLARE_EMAIL;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_API_KEY;
    delete process.env.CLOUDFLARE_EMAIL;

    const dir = mkdtempSync(join(tmpdir(), "em-remote-"));
    const remote = new RemoteCloudflareExecutionTarget(ctx(dir));
    await remote.prepare();
    const status = remote.getPrepareStatus();
    expect(status.configured).toBe(false);

    const trace = await remote.execute({
      id: "t1",
      name: "t1",
      request: { method: "GET", path: "/" },
    });
    expect(trace.status).toBe("REMOTE_NOT_CONFIGURED");
    expect(trace.statusReason).toMatch(/REMOTE_NOT_CONFIGURED|Cloudflare/i);

    if (prevToken) process.env.CLOUDFLARE_API_TOKEN = prevToken;
    if (prevKey) process.env.CLOUDFLARE_API_KEY = prevKey;
    if (prevEmail) process.env.CLOUDFLARE_EMAIL = prevEmail;
    rmSync(dir, { recursive: true, force: true });
  }, 90_000);

  it("preview prepare yields REMOTE_NOT_CONFIGURED without creds", async () => {
    const prevToken = process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_API_KEY;
    delete process.env.CLOUDFLARE_EMAIL;

    const dir = mkdtempSync(join(tmpdir(), "em-preview-"));
    const preview = new PreviewExecutionTarget(ctx(dir));
    await preview.prepare();
    expect(preview.getPrepareStatus().configured).toBe(false);
    const trace = await preview.execute({
      id: "t1",
      name: "t1",
      request: { method: "GET", path: "/" },
    });
    expect(trace.status).toBe("REMOTE_NOT_CONFIGURED");

    if (prevToken) process.env.CLOUDFLARE_API_TOKEN = prevToken;
    rmSync(dir, { recursive: true, force: true });
  }, 90_000);
});
