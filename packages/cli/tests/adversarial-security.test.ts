/**
 * Adversarial security suite — SSRF, path escape, webhooks, RBAC,
 * entitlement forgery, ownership confusion, runner auth.
 */

import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  assertAllowedPreviewUrl,
  resolveWorkerRequestUrl,
  sanitizeRequestPath,
  UrlSafetyError,
  isBlockedIpv4,
} from "../src/security/url.js";
import {
  PathEscapeError,
  resolveContained,
} from "../src/security/paths.js";
import {
  verifyGitHubWebhook,
  verifyStripeWebhook,
  WebhookValidationError,
  hmacSha256Hex,
} from "../src/security/webhooks.js";
import {
  authorize,
  assertSameTenant,
  AuthorizationError,
  type Principal,
} from "../src/security/rbac.js";
import {
  assertFeature,
  issueEntitlement,
  rejectUnsignedPlanClaim,
  verifyEntitlement,
  EntitlementError,
} from "../src/security/entitlements.js";
import {
  assertOwnedResourceSafe,
  OwnershipGuardError,
  ownershipMac,
} from "../src/security/ownership-guard.js";
import {
  claimResource,
  cleanupOwnedResources,
  type OwnedResource,
} from "../src/cleanup/ownership.js";
import {
  mintRunnerSecret,
  hashRunnerSecret,
  verifyRunnerCredential,
  RunnerAuthError,
  assertCiSecretsPolicy,
} from "../src/security/runner-auth.js";
import {
  clampRemoteBudget,
  HARD_MAX_REMOTE_RUNS,
  truncateToBytes,
} from "../src/security/limits.js";
import { resolveWranglerInvocation } from "../src/security/spawn.js";
import { loadCorpusPaths } from "../src/corpus/index.js";
import { redactString } from "../src/privacy/index.js";

describe("SSRF / request path", () => {
  it("rejects absolute and scheme-relative request paths", () => {
    expect(() => sanitizeRequestPath("https://evil.example/x")).toThrow(
      UrlSafetyError,
    );
    expect(() => sanitizeRequestPath("//evil.example/x")).toThrow(UrlSafetyError);
    expect(() => sanitizeRequestPath("http://169.254.169.254/latest")).toThrow(
      UrlSafetyError,
    );
  });

  it("keeps requests on the execution origin", () => {
    const url = resolveWorkerRequestUrl(
      "https://edgemirror-tmp-abcd1234.workers.dev",
      "/api/echo",
    );
    expect(url.origin).toBe("https://edgemirror-tmp-abcd1234.workers.dev");
    expect(url.pathname).toBe("/api/echo");
  });

  it("blocks private preview hosts", () => {
    expect(isBlockedIpv4("127.0.0.1")).toBe(true);
    expect(isBlockedIpv4("10.0.0.5")).toBe(true);
    expect(isBlockedIpv4("169.254.169.254")).toBe(true);
    expect(() => assertAllowedPreviewUrl("https://127.0.0.1/")).toThrow(
      UrlSafetyError,
    );
    expect(() =>
      assertAllowedPreviewUrl("https://evil.example/preview"),
    ).toThrow(UrlSafetyError);
    expect(
      assertAllowedPreviewUrl("https://foo.workers.dev/path"),
    ).toBe("https://foo.workers.dev/path");
  });
});

describe("path containment", () => {
  it("rejects corpus path traversal outside project root", () => {
    const root = mkdtempSync(join(tmpdir(), "em-sec-"));
    expect(() => resolveContained(root, "../../etc/passwd")).toThrow(
      PathEscapeError,
    );
    expect(() =>
      loadCorpusPaths(["../../etc/passwd"], root),
    ).toThrow(PathEscapeError);
  });

  it("allows paths inside the project", () => {
    const root = mkdtempSync(join(tmpdir(), "em-sec-"));
    const corpusDir = join(root, "corpus");
    mkdirSync(corpusDir);
    writeFileSync(
      join(corpusDir, "t.json"),
      JSON.stringify([
        {
          id: "t1",
          name: "ok",
          request: { method: "GET", path: "/ok" },
          expectedBehavior: "parity",
        },
      ]),
    );
    const tests = loadCorpusPaths(["corpus"], root);
    expect(tests).toHaveLength(1);
    expect(tests[0].request.path).toBe("/ok");
  });
});

describe("webhook validation", () => {
  const secret = "whsec_test_secret_value";
  const payload = JSON.stringify({ ok: true });

  it("accepts valid GitHub signatures and rejects forgeries", () => {
    const sig = `sha256=${hmacSha256Hex(secret, payload)}`;
    expect(() =>
      verifyGitHubWebhook({ secret, payload, signatureHeader: sig }),
    ).not.toThrow();
    expect(() =>
      verifyGitHubWebhook({
        secret,
        payload,
        signatureHeader: "sha256=" + "ab".repeat(32),
      }),
    ).toThrow(WebhookValidationError);
  });

  it("accepts valid Stripe signatures and rejects replay outside tolerance", () => {
    const t = Math.floor(Date.now() / 1000);
    const v1 = hmacSha256Hex(secret, `${t}.${payload}`);
    const header = `t=${t},v1=${v1}`;
    expect(() =>
      verifyStripeWebhook({ secret, payload, signatureHeader: header }),
    ).not.toThrow();
    expect(() =>
      verifyStripeWebhook({
        secret,
        payload,
        signatureHeader: `t=${t - 10_000},v1=${hmacSha256Hex(secret, `${t - 10_000}.${payload}`)}`,
      }),
    ).toThrow(WebhookValidationError);
  });
});

describe("RBAC / cross-tenant", () => {
  const alice: Principal = {
    userId: "u1",
    orgId: "org-a",
    roles: ["member"],
  };

  it("denies cross-tenant access", () => {
    expect(() =>
      assertSameTenant(alice, { orgId: "org-b", projectId: "p1" }),
    ).toThrow(AuthorizationError);
  });

  it("allows same-tenant permitted actions and denies privilege escalation", () => {
    expect(() =>
      authorize(alice, "run:create", { orgId: "org-a" }),
    ).not.toThrow();
    expect(() =>
      authorize(alice, "billing:write", { orgId: "org-a" }),
    ).toThrow(AuthorizationError);
  });
});

describe("billing entitlement forgery resistance", () => {
  const secret = "entitlement-signing-secret!!";

  it("rejects unsigned plan claims", () => {
    expect(() => rejectUnsignedPlanClaim({ plan: "enterprise" })).toThrow(
      EntitlementError,
    );
  });

  it("rejects forged tokens and feature escalation", () => {
    const token = issueEntitlement(secret, {
      orgId: "org-a",
      plan: "free",
      features: ["verify:local"],
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      subId: "sub_1",
    });
    expect(verifyEntitlement(secret, token).plan).toBe("free");

    const parts = token.split(".");
    const forged = `${parts[0]}.${parts[1]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(() => verifyEntitlement(secret, forged)).toThrow(EntitlementError);

    expect(() =>
      assertFeature(secret, token, "runner:hosted", "org-a"),
    ).toThrow(EntitlementError);
  });

  it("rejects org mismatch", () => {
    const token = issueEntitlement(secret, {
      orgId: "org-a",
      plan: "pro",
      features: ["verify:remote"],
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      subId: "sub_2",
    });
    expect(() => verifyEntitlement(secret, token, { expectedOrgId: "org-b" })).toThrow(
      EntitlementError,
    );
  });
});

describe("ownership confused deputy", () => {
  it("refuses cleanup of non-edgemirror-tmp names", async () => {
    const dir = mkdtempSync(join(tmpdir(), "em-own-"));
    const forged: OwnedResource = {
      id: "00000000-0000-4000-8000-000000000001",
      type: "worker",
      name: "production-worker",
      createdAt: new Date().toISOString(),
      edgemirrorOwned: true,
      metadata: {},
    };
    writeFileSync(join(dir, `${forged.id}.json`), JSON.stringify(forged));
    const result = await cleanupOwnedResources(dir, async () => true);
    expect(result.cleaned).toHaveLength(0);
    expect(result.skipped.some((s) => s.includes("production-worker"))).toBe(
      true,
    );
  });

  it("claims only temp workers and validates MAC when secret set", () => {
    const prev = process.env.EDGEMIRROR_OWNERSHIP_SECRET;
    process.env.EDGEMIRROR_OWNERSHIP_SECRET = "ownership-mac-secret!";
    try {
      const dir = mkdtempSync(join(tmpdir(), "em-own2-"));
      const resource = claimResource({
        ownershipDir: dir,
        type: "worker",
        name: "edgemirror-tmp-deadbeef",
      });
      expect(resource.metadata.ownershipMac).toBeTypeOf("string");
      expect(() => assertOwnedResourceSafe(resource)).not.toThrow();

      const tampered = {
        ...resource,
        name: "edgemirror-tmp-cafebabe",
        metadata: { ...resource.metadata },
      };
      expect(() => assertOwnedResourceSafe(tampered)).toThrow(OwnershipGuardError);

      // Fix MAC for new name but still ok if regenerating
      tampered.metadata.ownershipMac = ownershipMac(
        process.env.EDGEMIRROR_OWNERSHIP_SECRET!,
        tampered,
      );
      expect(() => assertOwnedResourceSafe(tampered)).not.toThrow();
    } finally {
      if (prev === undefined) delete process.env.EDGEMIRROR_OWNERSHIP_SECRET;
      else process.env.EDGEMIRROR_OWNERSHIP_SECRET = prev;
    }
  });
});

describe("runner auth assumptions", () => {
  it("verifies bearer secrets and rejects forgeries", () => {
    const minted = mintRunnerSecret();
    const record = {
      tokenId: minted.tokenId,
      orgId: "org-a",
      secretHash: hashRunnerSecret(minted.secret),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
    expect(
      verifyRunnerCredential({
        authorizationHeader: `Bearer ${minted.bearer}`,
        record,
        expectedOrgId: "org-a",
      }).orgId,
    ).toBe("org-a");

    expect(() =>
      verifyRunnerCredential({
        authorizationHeader: `Bearer ${minted.bearer.slice(0, -2)}xx`,
        record,
      }),
    ).toThrow(RunnerAuthError);
  });

  it("flags Cloudflare secrets on fork PR env", () => {
    const policy = assertCiSecretsPolicy({
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_HEAD_REF: "feature",
      GITHUB_REPOSITORY: "org/repo",
      EDGEMIRROR_PR_FROM_FORK: "true",
      CLOUDFLARE_API_TOKEN: "secret",
    } as NodeJS.ProcessEnv);
    expect(policy.ok).toBe(false);
  });
});

describe("resource limits + spawn argv safety", () => {
  it("clamps remote budgets to hard ceilings", () => {
    expect(clampRemoteBudget({ maxRuns: 99999, maxDurationMinutes: 999 }).maxRuns).toBe(
      HARD_MAX_REMOTE_RUNS,
    );
  });

  it("truncates large bodies", () => {
    const big = "a".repeat(1000);
    const out = truncateToBytes(big, 100);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBeLessThan(big.length);
  });

  it("prefers node-entry wrangler without shell when installed", () => {
    // Monorepo root or package may have wrangler as cli devDependency.
    const inv = resolveWranglerInvocation(process.cwd(), ["--version"]);
    expect(inv.shell).toBe(false);
    expect(inv.args.includes("--version")).toBe(true);
  });
});

describe("secret redaction", () => {
  it("redacts runner tokens and stripe keys", () => {
    const sample =
      "token=emr_abcd1234.supersecretvalue stripe=sk_test_abc123Bearer xyz";
    const { value, redactions } = redactString(sample);
    expect(value).not.toContain("supersecretvalue");
    expect(value).not.toContain("sk_test_abc123");
    expect(redactions.length).toBeGreaterThan(0);
  });
});
