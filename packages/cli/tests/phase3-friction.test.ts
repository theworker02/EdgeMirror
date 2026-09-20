import { describe, expect, it } from "vitest";
import { runDemo, DEMO_FINDING_PREFIX, DEMO_MARKER } from "../src/demo/index.js";
import { discoverZeroConfig } from "../src/discovery/zeroconfig.js";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ONBOARDING_MENU } from "../src/cli/onboarding.js";
import { detectCiProvider } from "../src/cli/commands/init.js";

describe("edgemirror demo", () => {
  it("produces DEMO-labeled finding without touching caller cwd corpus", async () => {
    const caller = mkdtempSync(join(tmpdir(), "em-caller-"));
    writeFileSync(join(caller, "marker.txt"), "real-project");
    const prev = process.cwd();
    process.chdir(caller);
    try {
      const result = await runDemo({ quiet: true, keep: false });
      expect(result.demo).toBe(true);
      expect(result.findingId.startsWith(DEMO_FINDING_PREFIX)).toBe(true);
      expect(result.report.results[0]?.findingId).toBe(result.findingId);
      expect(result.report.remoteReason).toMatch(/DEMO|synthesized/i);
      expect(result.report.checks?.[0]?.id).toBe("demo");
      // Classification should reflect divergence, not MATCH
      expect(result.report.results[0]?.classification).not.toBe("MATCH");
      expect(result.report.results[0]?.classification).not.toBe(
        "REMOTE_NOT_CONFIGURED",
      );
      void DEMO_MARKER;
    } finally {
      process.chdir(prev);
      rmSync(caller, { recursive: true, force: true });
    }
  });
});

describe("create-cloudflare detection", () => {
  it("flags C3-like layouts", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-c3-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "my-worker",
        scripts: { dev: "wrangler dev", deploy: "wrangler deploy" },
        devDependencies: {
          wrangler: "^4.0.0",
          "@cloudflare/workers-types": "^4.0.0",
        },
      }),
    );
    writeFileSync(
      join(dir, "wrangler.jsonc"),
      JSON.stringify({
        name: "my-worker",
        main: "src/index.ts",
        compatibility_date: "2025-04-01",
      }),
    );
    const zc = discoverZeroConfig(dir);
    expect(zc.createCloudflare.detected).toBe(true);
    expect(zc.createCloudflare.signals.length).toBeGreaterThan(0);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("onboarding menu", () => {
  it("maps every item to a scriptable command", () => {
    for (const item of ONBOARDING_MENU) {
      if (item.key === "q") continue;
      expect(item.command.length).toBeGreaterThan(0);
      expect(item.command.startsWith("edgemirror") || item.command === "(exit)").toBe(
        true,
      );
    }
  });
});

describe("init --ci detection", () => {
  it("detects github from .github folder", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-ci-"));
    writeFileSync(join(dir, "package.json"), "{}");
    mkdirSync(join(dir, ".github"), { recursive: true });
    expect(detectCiProvider(dir)).toBe("github");
    rmSync(dir, { recursive: true, force: true });
  });
});
