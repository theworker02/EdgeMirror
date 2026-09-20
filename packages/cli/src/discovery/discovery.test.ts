import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  discoverProject,
  EdgeMirrorDiscoveryError,
  parseWranglerConfig,
  summarizeBindings,
} from "../discovery/index.js";
import { discoverZeroConfig } from "../discovery/zeroconfig.js";
import { loadConfig, writeDefaultConfig } from "../config/index.js";
import { redactString } from "../privacy/index.js";
import {
  claimResource,
  listOwnedResources,
  cleanupOwnedResources,
} from "../cleanup/ownership.js";
import { createEvidenceBundle, verifyBundle } from "../bundle/index.js";
import {
  createReceipt,
  writeReceipt,
  writeTrace,
  hashPayload,
} from "../provenance/index.js";
import {
  createFingerprint,
  createTrace,
  emptyBindingSummary,
  emptyObservations,
  captured,
} from "../trace/factory.js";
import { buildParityResult } from "../diff/index.js";
import { BUILTIN_CORPUS, selectTests } from "../corpus/index.js";

describe("wrangler config parsing", () => {
  it("parses jsonc with comments", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-jsonc-"));
    const path = join(dir, "wrangler.jsonc");
    writeFileSync(
      path,
      `{
  // comment
  "name": "demo",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "kv_namespaces": [{ "binding": "KV" }]
}`,
    );
    const cfg = parseWranglerConfig(path);
    expect(cfg.name).toBe("demo");
    expect(cfg.compatibility_date).toBe("2025-04-01");
    expect(summarizeBindings(cfg).kv).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it("throws on missing wrangler", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-none-"));
    expect(() => discoverProject(dir)).toThrow(EdgeMirrorDiscoveryError);
    rmSync(dir, { recursive: true, force: true });
  });

  it("discovers fixture basic-worker", () => {
    const fixture = join(
      process.cwd(),
      "..",
      "..",
      "fixtures",
      "basic-worker",
    );
    // When tests run from packages/cli, fixtures are at repo root
    const rootCandidates = [
      join(process.cwd(), "fixtures", "basic-worker"),
      join(process.cwd(), "..", "..", "fixtures", "basic-worker"),
    ];
    const root = rootCandidates.find((p) => {
      try {
        return Boolean(parseWranglerConfig(join(p, "wrangler.jsonc")));
      } catch {
        return false;
      }
    });
    expect(root).toBeTruthy();
    const project = discoverProject(root!);
    expect(project.wranglerConfig.name).toBe("edgemirror-fixture-basic");
    expect(project.fingerprint.cloudflareAuth).toMatch(
      /configured|missing|unknown/,
    );
  });
});

describe("zero-config discovery", () => {
  it("infers package manager and checks", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-zc-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "demo",
        scripts: { test: "vitest run" },
        devDependencies: { vitest: "^3.0.0" },
      }),
    );
    writeFileSync(join(dir, "package-lock.json"), "{}");
    writeFileSync(join(dir, "vitest.config.ts"), "export default {}");
    writeFileSync(
      join(dir, "wrangler.jsonc"),
      JSON.stringify({
        name: "demo",
        main: "index.ts",
        compatibility_date: "2025-04-01",
      }),
    );
    writeFileSync(join(dir, "index.ts"), "export default { fetch(){} }");

    const zc = discoverZeroConfig(dir);
    expect(zc.packageManager).toBe("npm");
    expect(zc.vitest.detected).toBe(true);
    expect(zc.hasWrangler).toBe(true);
    expect(zc.inferredChecks.some((c) => c.id === "remote-parity")).toBe(true);
    expect(zc.createCloudflare).toBeDefined();
    expect(zc.createCloudflare.detected).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("config + privacy + ownership", () => {
  it("writes and loads default config", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-cfg-"));
    writeDefaultConfig(dir);
    const cfg = loadConfig(dir);
    expect(cfg.remote.maxRuns).toBe(200);
    expect(cfg.corpus.includeBuiltin).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("redacts bearer tokens", () => {
    const { value, redactions } = redactString(
      "Authorization: Bearer super-secret-token-value",
    );
    expect(value).toContain("[REDACTED]");
    expect(redactions.length).toBeGreaterThan(0);
  });

  it("only cleans EdgeMirror-owned resources", async () => {
    const dir = mkdtempSync(join(tmpdir(), "em-own-"));
    claimResource({ ownershipDir: dir, type: "worker", name: "em-tmp-1" });
    expect(listOwnedResources(dir)).toHaveLength(1);
    const result = await cleanupOwnedResources(dir, async () => true);
    expect(result.cleaned).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("corpus + provenance + bundle", () => {
  it("selects builtin corpus", () => {
    expect(BUILTIN_CORPUS.length).toBeGreaterThan(0);
    const filtered = selectTests({
      includeBuiltin: true,
      filter: "echo",
    });
    expect(filtered.every((t) => /echo/i.test(t.id) || /echo/i.test(t.name))).toBe(
      true,
    );
  });

  it("creates verifiable evidence bundle", () => {
    const dir = mkdtempSync(join(tmpdir(), "em-bun-"));
    const em = join(dir, ".edgemirror");
    const runDir = join(em, "runs", "run-test");
    mkdirSync(join(runDir, "receipts"), { recursive: true });
    mkdirSync(join(runDir, "traces"), { recursive: true });

    const fp = createFingerprint({
      projectRoot: dir,
      compatibilityFlags: [],
      bindings: emptyBindingSummary(),
    });
    const obs = emptyObservations();
    obs.http.status = captured(200);
    obs.http.body = captured("ok");
    const local = createTrace({
      testId: "t1",
      target: "local",
      status: "ok",
      configurationFingerprint: fp,
      observations: obs,
    });
    const remote = createTrace({
      testId: "t1",
      target: "remote",
      status: "REMOTE_NOT_CONFIGURED",
      statusReason: "no creds",
      configurationFingerprint: fp,
    });
    const localPath = writeTrace(join(runDir, "traces"), local);
    const remotePath = writeTrace(join(runDir, "traces"), remote);
    const result = buildParityResult({
      testId: "t1",
      local,
      remote,
      findingId: "EM-001",
    });
    const receipt = createReceipt({
      findingId: "EM-001",
      result,
      localTrace: local,
      remoteTrace: remote,
      artifactPaths: [localPath, remotePath],
    });
    writeReceipt(join(runDir, "receipts"), receipt);
    expect(hashPayload(receipt).length).toBe(64);

    const { bundleDir, manifest } = createEvidenceBundle({
      projectRoot: dir,
      targetId: "EM-001",
    });
    expect(manifest.files.length).toBeGreaterThan(0);
    expect(verifyBundle(bundleDir).ok).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
