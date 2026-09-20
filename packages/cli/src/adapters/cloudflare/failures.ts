/**
 * Classify Cloudflare infrastructure failures so they never become
 * false RUNTIME_DIVERGENCE / parity findings.
 */

export type InfraFailureKind =
  | "auth_invalid"
  | "auth_expired"
  | "auth_missing"
  | "permission_denied"
  | "deploy_failed"
  | "preview_unavailable"
  | "rate_limited"
  | "network"
  | "cleanup_failed"
  | "unknown_infra";

export interface ClassifiedInfraFailure {
  kind: InfraFailureKind;
  /** Safe to show in reports — no secrets */
  message: string;
  /** Trace status EdgeMirror should emit */
  traceStatus: "REMOTE_NOT_CONFIGURED" | "error" | "SKIPPED";
  /** Never treat as a parity divergence */
  isParityFinding: false;
}

const PATTERNS: Array<{
  kind: InfraFailureKind;
  re: RegExp;
  message: string;
  traceStatus: ClassifiedInfraFailure["traceStatus"];
}> = [
  {
    kind: "auth_missing",
    re: /REMOTE_NOT_CONFIGURED|not authenticated|not logged in|No account/i,
    message: "Cloudflare authentication is not configured.",
    traceStatus: "REMOTE_NOT_CONFIGURED",
  },
  {
    kind: "auth_invalid",
    re: /Invalid API Token|Authentication error|401\b/i,
    message: "Cloudflare authentication failed (invalid credentials).",
    traceStatus: "REMOTE_NOT_CONFIGURED",
  },
  {
    kind: "auth_expired",
    re: /expired|token.*revoked|session.*expired/i,
    message: "Cloudflare credentials appear expired or revoked.",
    traceStatus: "REMOTE_NOT_CONFIGURED",
  },
  {
    kind: "permission_denied",
    re: /permission|forbidden|403\b|Workers Scripts/i,
    message: "Cloudflare account lacks required Workers Scripts:Edit permission.",
    traceStatus: "REMOTE_NOT_CONFIGURED",
  },
  {
    kind: "rate_limited",
    re: /rate.?limit|429\b|too many requests/i,
    message: "Cloudflare API rate limit encountered.",
    traceStatus: "error",
  },
  {
    kind: "preview_unavailable",
    re: /PREVIEW_NOT_AVAILABLE|versions upload|preview URL/i,
    message: "Cloudflare preview/version URL could not be created.",
    traceStatus: "REMOTE_NOT_CONFIGURED",
  },
  {
    kind: "network",
    re: /ENOTFOUND|ECONNREFUSED|ETIMEDOUT|fetch failed|network/i,
    message: "Network failure talking to Cloudflare or the Worker URL.",
    traceStatus: "error",
  },
  {
    kind: "cleanup_failed",
    re: /cleanup|delete.*failed|wrangler delete/i,
    message: "Cleanup of an EdgeMirror-owned resource failed.",
    traceStatus: "error",
  },
  {
    kind: "deploy_failed",
    re: /deploy failed|REMOTE EXECUTION FAILED|Published/i,
    message: "Wrangler deploy of the isolated EdgeMirror Worker failed.",
    traceStatus: "REMOTE_NOT_CONFIGURED",
  },
];

export function classifyInfraFailure(output: string): ClassifiedInfraFailure {
  for (const p of PATTERNS) {
    if (p.re.test(output)) {
      return {
        kind: p.kind,
        message: p.message,
        traceStatus: p.traceStatus,
        isParityFinding: false,
      };
    }
  }
  return {
    kind: "unknown_infra",
    message: "Cloudflare infrastructure error (not a parity finding).",
    traceStatus: "error",
    isParityFinding: false,
  };
}

export function formatInfraFailureReport(failure: ClassifiedInfraFailure): string {
  return [
    "INFRASTRUCTURE ERROR (not a parity finding)",
    "",
    `Kind: ${failure.kind}`,
    failure.message,
    "",
    "This does not indicate a Workers runtime divergence.",
  ].join("\n");
}
