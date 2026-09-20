import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_BINDING_SUPPORT,
  formatBindingsSupportTable,
  getBindingSupport,
} from "./bindings.js";
import {
  classifyInfraFailure,
  formatInfraFailureReport,
} from "./failures.js";
import {
  detectCloudflareAuth,
  remoteNotConfiguredMessage,
} from "./auth.js";
import { buildCloudflareSupportReport } from "./support-report.js";
import { CloudflareBindingAdapter } from "./index.js";
import { classifyComparison } from "../../diff/index.js";
import {
  createFingerprint,
  createTrace,
  emptyBindingSummary,
  emptyObservations,
  captured,
} from "../../trace/factory.js";

describe("cloudflare bindings support matrix", () => {
  it("covers core Workers surfaces with honest levels", () => {
    const ids = CLOUDFLARE_BINDING_SUPPORT.map((b) => b.id);
    expect(ids).toContain("http-fetch");
    expect(ids).toContain("kv");
    expect(ids).toContain("d1");
    expect(ids).toContain("durable-objects");
    expect(ids).toContain("websockets");
    expect(getBindingSupport("http-fetch")?.parity).toBe("STABLE");
    expect(getBindingSupport("workers-ai")?.parity).toBe("UNSUPPORTED");
    expect(getBindingSupport("queues")?.parity).toBe("UNSUPPORTED");
  });

  it("formats a table without inventing levels", () => {
    const table = formatBindingsSupportTable();
    expect(table).toMatch(/STABLE/);
    expect(table).toMatch(/UNSUPPORTED/);
    expect(table).toMatch(/EdgeMirror capability/);
  });

  it("summarizes declared bindings from wrangler config", () => {
    const adapter = new CloudflareBindingAdapter();
    const summary = adapter.summarize({
      name: "x",
      main: "src/index.ts",
      kv_namespaces: [{ binding: "KV" }],
      d1_databases: [{ binding: "DB" }],
    });
    expect(summary.counts).toMatchObject({ kv: 1, d1: 1 });
    const present = summary.present as Array<{ id: string }>;
    expect(present.map((p) => p.id)).toEqual(
      expect.arrayContaining(["kv", "d1"]),
    );
  });
});

describe("infra failure classification", () => {
  it("does not treat auth failures as parity findings", () => {
    const f = classifyInfraFailure("Invalid API Token 401");
    expect(f.isParityFinding).toBe(false);
    expect(f.kind).toBe("auth_invalid");
    expect(f.traceStatus).toBe("REMOTE_NOT_CONFIGURED");
    expect(formatInfraFailureReport(f)).toMatch(/not a parity finding/i);
  });

  it("classifies rate limits and network as infra errors", () => {
    expect(classifyInfraFailure("429 too many requests").kind).toBe(
      "rate_limited",
    );
    expect(classifyInfraFailure("fetch failed ETIMEDOUT").kind).toBe("network");
  });
});

describe("auth detection", () => {
  it("reports none without inventing credentials", () => {
    const prev = {
      token: process.env.CLOUDFLARE_API_TOKEN,
      key: process.env.CLOUDFLARE_API_KEY,
      email: process.env.CLOUDFLARE_EMAIL,
    };
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_API_KEY;
    delete process.env.CLOUDFLARE_EMAIL;
    const status = detectCloudflareAuth();
    // May be wrangler_oauth if user has local login — never invent token mode
    expect(["none", "wrangler_oauth"]).toContain(status.mode);
    expect(remoteNotConfiguredMessage("preview")).toMatch(
      /REMOTE_NOT_CONFIGURED/,
    );
    if (prev.token) process.env.CLOUDFLARE_API_TOKEN = prev.token;
    if (prev.key) process.env.CLOUDFLARE_API_KEY = prev.key;
    if (prev.email) process.env.CLOUDFLARE_EMAIL = prev.email;
  });
});

describe("support report", () => {
  it("is machine-readable for Agent 4", () => {
    const report = buildCloudflareSupportReport();
    expect(report.schemaVersion).toBe("1.0");
    expect(report.authentication.whenMissing).toBe("REMOTE_NOT_CONFIGURED");
    expect(report.bindings.length).toBeGreaterThan(5);
    expect(report.honesty.some((h) => /not affiliated/i.test(h))).toBe(true);
  });
});

describe("failure quality vs parity", () => {
  it("maps remote error traces to INSUFFICIENT_EVIDENCE not RUNTIME_DIVERGENCE", () => {
    const fp = createFingerprint({
      projectRoot: "/tmp",
      compatibilityFlags: [],
      bindings: emptyBindingSummary(),
    });
    const localObs = emptyObservations();
    localObs.http.status = captured(200);
    localObs.http.body = captured("ok");
    const local = createTrace({
      testId: "t",
      target: "local",
      status: "ok",
      configurationFingerprint: fp,
      observations: localObs,
    });
    const remote = createTrace({
      testId: "t",
      target: "remote",
      status: "error",
      statusReason: "ETIMEDOUT",
      configurationFingerprint: fp,
      observations: emptyObservations(),
    });
    expect(
      classifyComparison({ local, remote, differences: [] }),
    ).toBe("INSUFFICIENT_EVIDENCE");
  });
});
