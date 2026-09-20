/**
 * Hosted runner authentication assumptions and token checks.
 *
 * Assumptions (enforce in control-plane when runners ship):
 * 1. Runner tokens are org-scoped, single-purpose, and rotatable.
 * 2. Tokens are presented as `Authorization: Bearer emr_<id>.<secret>`.
 * 3. Secrets are stored hashed server-side; plaintext only at mint time.
 * 4. Runner may only create/read runs for its org (see rbac `runner` role).
 * 5. Fork PR CI must not receive runner or Cloudflare secrets by default.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export class RunnerAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunnerAuthError";
  }
}

export interface RunnerTokenParts {
  tokenId: string;
  secret: string;
}

export interface RunnerCredentialRecord {
  tokenId: string;
  orgId: string;
  /** sha256 hex of secret */
  secretHash: string;
  expiresAt: number;
  revoked?: boolean;
}

export const RUNNER_AUTH_ASSUMPTIONS = [
  "Runner tokens are org-scoped and never shared across tenants",
  "Bearer scheme only; query-string tokens are rejected",
  "Secrets compared via SHA-256 hash + timing-safe equal",
  "Expired or revoked credentials deny closed",
  "Fork pull_request workflows do not receive CLOUDFLARE_* or runner secrets",
] as const;

const PREFIX = "emr_";

export function mintRunnerSecret(): { tokenId: string; secret: string; bearer: string } {
  const tokenId = randomBytes(8).toString("hex");
  const secret = randomBytes(24).toString("base64url");
  return {
    tokenId,
    secret,
    bearer: `${PREFIX}${tokenId}.${secret}`,
  };
}

export function hashRunnerSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function parseRunnerBearer(
  authorizationHeader: string | undefined,
): RunnerTokenParts {
  if (!authorizationHeader) {
    throw new RunnerAuthError("Missing Authorization header");
  }
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    throw new RunnerAuthError("Authorization must be Bearer");
  }
  const token = match[1];
  if (token.includes("?") || token.includes("&")) {
    throw new RunnerAuthError("Runner tokens must not appear in query strings");
  }
  if (!token.startsWith(PREFIX)) {
    throw new RunnerAuthError("Unrecognized runner token prefix");
  }
  const body = token.slice(PREFIX.length);
  const dot = body.indexOf(".");
  if (dot <= 0 || dot === body.length - 1) {
    throw new RunnerAuthError("Malformed runner token");
  }
  return {
    tokenId: body.slice(0, dot),
    secret: body.slice(dot + 1),
  };
}

export function verifyRunnerCredential(input: {
  authorizationHeader: string | undefined;
  record: RunnerCredentialRecord | undefined;
  expectedOrgId?: string;
  nowSeconds?: number;
}): RunnerCredentialRecord {
  const parts = parseRunnerBearer(input.authorizationHeader);
  if (!input.record || input.record.tokenId !== parts.tokenId) {
    throw new RunnerAuthError("Unknown runner token");
  }
  if (input.record.revoked) {
    throw new RunnerAuthError("Runner token revoked");
  }
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (input.record.expiresAt < now) {
    throw new RunnerAuthError("Runner token expired");
  }
  if (input.expectedOrgId && input.record.orgId !== input.expectedOrgId) {
    throw new RunnerAuthError("Runner token org mismatch");
  }

  const actual = Buffer.from(hashRunnerSecret(parts.secret), "hex");
  const expected = Buffer.from(input.record.secretHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new RunnerAuthError("Runner token secret mismatch");
  }

  return input.record;
}

/** CI helper: fork PRs should not see privileged env. */
export function assertCiSecretsPolicy(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const isFork =
    env.GITHUB_EVENT_NAME === "pull_request" &&
    env.GITHUB_HEAD_REF !== undefined &&
    env.GITHUB_REPOSITORY !== undefined &&
    Boolean(env.EDGEMIRROR_PR_FROM_FORK === "true" || env.EDGEMIRROR_FORK_PR === "true");

  if (isFork) {
    if (env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_KEY) {
      reasons.push("Cloudflare credentials must not be available on fork PRs");
    }
    if (env.EDGEMIRROR_RUNNER_TOKEN) {
      reasons.push("Runner tokens must not be available on fork PRs");
    }
  }

  return { ok: reasons.length === 0, reasons };
}
