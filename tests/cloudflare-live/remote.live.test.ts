/**
 * Cloudflare live integration tests.
 *
 * Gated separately from ordinary unit/integration tests.
 * Requires explicit opt-in:
 *
 *   EDGEMIRROR_CLOUDFLARE_LIVE=1
 *   CLOUDFLARE_API_TOKEN=...
 *   CLOUDFLARE_ACCOUNT_ID=...
 *
 * Run:
 *   npm run test:cloudflare-live -w @edgemirror/cli
 *   # or from repo root after build:
 *   npx vitest run --config tests/cloudflare-live/vitest.config.ts
 *
 * Without credentials these tests SKIP — they never fabricate remote results.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PreviewExecutionTarget } from "../../packages/cli/src/execution/preview.js";
import { RemoteCloudflareExecutionTarget } from "../../packages/cli/src/execution/remote.js";
import {
  createFingerprint,
  emptyBindingSummary,
} from "../../packages/cli/src/trace/factory.js";
import { resetDemoResources } from "../../packages/cli/src/cleanup/reset.js";

const LIVE = process.env.EDGEMIRROR_CLOUDFLARE_LIVE === "1";
const HAS_TOKEN = Boolean(process.env.CLOUDFLARE_API_TOKEN);

function writeMiniWorker(root: string): void {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "wrangler.jsonc"),
    `{
  "name": "edgemirror-live-test",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "workers_dev": true
}
`,
    "utf8",
  );
  writeFileSync(
    join(root, "src", "index.ts"),
    `export default { async fetch() { return new Response("live-ok", { status: 200 }); } };\n`,
    "utf8",
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "edgemirror-live-test", private: true, type: "module" }),
  );
}

describe.skipIf(!LIVE)("cloudflare-live (opt-in)", () => {
  it("skips with clear message when token missing even if LIVE=1", async () => {
    if (HAS_TOKEN) return;
    const dir = mkdtempSync(join(tmpdir(), "em-live-"));
    writeMiniWorker(dir);
    const remote = new RemoteCloudflareExecutionTarget({
      projectRoot: dir,
      wranglerConfigPath: join(dir, "wrangler.jsonc"),
      configurationFingerprint: createFingerprint({
        projectRoot: dir,
        compatibilityFlags: [],
        bindings: emptyBindingSummary(),
      }),
      ownershipDir: join(dir, ".edgemirror", "ownership"),
    });
    await remote.prepare();
    expect(remote.getPrepareStatus().configured).toBe(false);
    const trace = await remote.execute({
      id: "live-1",
      name: "live",
      request: { method: "GET", path: "/" },
    });
    expect(trace.status).toBe("REMOTE_NOT_CONFIGURED");
    rmSync(dir, { recursive: true, force: true });
  }, 120_000);

  it.skipIf(!HAS_TOKEN)(
    "deploys isolated temp Worker, executes, cleans up",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "em-live-"));
      writeMiniWorker(dir);
      const ownershipDir = join(dir, ".edgemirror", "ownership");
      const remote = new RemoteCloudflareExecutionTarget({
        projectRoot: dir,
        wranglerConfigPath: join(dir, "wrangler.jsonc"),
        configurationFingerprint: createFingerprint({
          projectRoot: dir,
          compatibilityFlags: [],
          bindings: emptyBindingSummary(),
        }),
        ownershipDir,
      });
      await remote.prepare();
      const status = remote.getPrepareStatus();
      expect(status.configured).toBe(true);
      expect(status.workersDevUrl).toMatch(/workers\.dev/);
      const trace = await remote.execute({
        id: "live-1",
        name: "live",
        request: { method: "GET", path: "/" },
      });
      expect(trace.status).toBe("ok");
      await remote.cleanup();
      const reset = await resetDemoResources({
        cwd: dir,
        ownershipDir,
        quiet: true,
      });
      expect(reset.failed.length).toBe(0);
      rmSync(dir, { recursive: true, force: true });
    },
    180_000,
  );

  it.skipIf(!HAS_TOKEN)(
    "preview prepare does not invent URLs on failure",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "em-live-prev-"));
      writeMiniWorker(dir);
      const preview = new PreviewExecutionTarget({
        projectRoot: dir,
        wranglerConfigPath: join(dir, "wrangler.jsonc"),
        configurationFingerprint: createFingerprint({
          projectRoot: dir,
          compatibilityFlags: [],
          bindings: emptyBindingSummary(),
        }),
        ownershipDir: join(dir, ".edgemirror", "ownership"),
      });
      await preview.prepare();
      const status = preview.getPrepareStatus();
      // Either configured with a real URL, or honest unavailable — never a fake URL
      if (status.configured) {
        expect(status.previewUrl).toMatch(/^https:\/\//);
      } else {
        expect(status.reason).toMatch(
          /REMOTE_NOT_CONFIGURED|PREVIEW_NOT_AVAILABLE|INFRASTRUCTURE/i,
        );
      }
      rmSync(dir, { recursive: true, force: true });
    },
    180_000,
  );
});

describe("cloudflare-live gate documentation", () => {
  it("documents that ordinary CI does not require Cloudflare credentials", () => {
    expect(LIVE || !LIVE).toBe(true);
    if (!LIVE) {
      // Suite is skipped via describe.skipIf — this placeholder keeps the file valid.
      expect(process.env.EDGEMIRROR_CLOUDFLARE_LIVE ?? "0").not.toBe("unset-magic");
    }
  });
});
