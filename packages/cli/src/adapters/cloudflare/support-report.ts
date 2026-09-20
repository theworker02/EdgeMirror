/**
 * Machine-readable Cloudflare support report for Agent 4 / docs.
 */

import { EDGEMIRROR_VERSION } from "../../version.js";
import {
  CLOUDFLARE_BINDING_SUPPORT,
  type BindingFeatureSupport,
} from "./bindings.js";

export interface CloudflareSupportReport {
  schemaVersion: "1.0";
  generatedAt: string;
  edgemirrorVersion: string;
  runtime: {
    id: string;
    displayName: string;
    local: { engine: string; quality: string; notes: string };
    remote: { engine: string; quality: string; notes: string };
    preview: { engine: string; quality: string; notes: string };
  };
  authentication: {
    supported: string[];
    requiredEnv: string[];
    whenMissing: "REMOTE_NOT_CONFIGURED";
  };
  commands: Array<{
    command: string;
    purpose: string;
    requiresCredentials: boolean;
  }>;
  bindings: BindingFeatureSupport[];
  honesty: string[];
  dogfood: {
    usesCloudflareProducts: string[];
    notes: string;
  };
}

export function buildCloudflareSupportReport(): CloudflareSupportReport {
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runtime: {
      id: "cloudflare-workers",
      displayName: "Cloudflare Workers",
      local: {
        engine: "workerd via wrangler dev --local",
        quality: "production-quality for HTTP parity",
        notes: "Spawns ephemeral local port; captures status/headers/body.",
      },
      remote: {
        engine: "isolated edgemirror-tmp-* Worker on workers.dev",
        quality: "production-quality when credentials present",
        notes:
          "Requires CLOUDFLARE_API_TOKEN (or wrangler login). Ownership markers track cleanup.",
      },
      preview: {
        engine: "wrangler versions upload preview URL",
        quality: "production-quality when credentials present",
        notes: "Falls back to REMOTE_NOT_CONFIGURED / PREVIEW_NOT_AVAILABLE honestly.",
      },
    },
    authentication: {
      supported: [
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL",
        "wrangler OAuth login",
      ],
      requiredEnv: ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"],
      whenMissing: "REMOTE_NOT_CONFIGURED",
    },
    commands: [
      {
        command: "edgemirror doctor",
        purpose: "Fingerprint Wrangler/workerd/auth/bindings",
        requiresCredentials: false,
      },
      {
        command: "edgemirror verify --local",
        purpose: "Local-only parity preparation",
        requiresCredentials: false,
      },
      {
        command: "edgemirror verify",
        purpose: "Local vs remote parity",
        requiresCredentials: true,
      },
      {
        command: "edgemirror preview",
        purpose: "Local vs preview URL parity",
        requiresCredentials: true,
      },
      {
        command: "edgemirror compat / matrix",
        purpose: "Real local compatibility-date matrix (no fabricated cells)",
        requiresCredentials: false,
      },
      {
        command: "edgemirror demo",
        purpose: "Offline DEMO labeled divergence",
        requiresCredentials: false,
      },
      {
        command: "edgemirror pitch-demo / demo cloudflare",
        purpose: "Live meeting demo: real local + optional preview",
        requiresCredentials: false,
      },
      {
        command: "edgemirror demo reset",
        purpose: "Cleanup EdgeMirror-owned Cloudflare resources only",
        requiresCredentials: true,
      },
    ],
    bindings: CLOUDFLARE_BINDING_SUPPORT,
    honesty: [
      "EdgeMirror is not affiliated with Cloudflare, Inc.",
      "Missing credentials yield REMOTE_NOT_CONFIGURED — never fabricated remote traces.",
      "Compat/matrix cells are only written after real local executions.",
      "Infrastructure failures are never classified as RUNTIME_DIVERGENCE.",
      "DEMO / pitch findings are labeled and isolated from real project corpora.",
      "Support levels describe EdgeMirror capability, not Cloudflare product GA status.",
    ],
    dogfood: {
      usesCloudflareProducts: [
        "Wrangler (dev, deploy, versions upload, delete, whoami)",
        "workerd (via wrangler dev --local)",
        "workers.dev temporary Workers for remote parity",
      ],
      notes:
        "EdgeMirror orchestrates Wrangler; it does not replace Cloudflare tooling. Hosted EdgeMirror Cloud may later run on Workers where appropriate — not required for CLI correctness.",
    },
  };
}
