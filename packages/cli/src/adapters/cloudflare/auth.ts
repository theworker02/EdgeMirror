/**
 * Cloudflare authentication detection — never logs or embeds secrets.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export type CloudflareAuthMode =
  | "api_token"
  | "api_key_email"
  | "wrangler_oauth"
  | "none";

export interface CloudflareAuthStatus {
  mode: CloudflareAuthMode;
  /** Human-safe label — never includes token material. */
  label: string;
  configured: boolean;
  accountIdPresent: boolean;
  hints: string[];
}

export function hasCloudflareCredentials(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN ||
      process.env.CLOUDFLARE_API_KEY ||
      process.env.CLOUDFLARE_EMAIL,
  );
}

export function detectCloudflareAuth(): CloudflareAuthStatus {
  const accountIdPresent = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID);
  const hints: string[] = [];

  if (process.env.CLOUDFLARE_API_TOKEN) {
    return {
      mode: "api_token",
      label: "CLOUDFLARE_API_TOKEN present",
      configured: true,
      accountIdPresent,
      hints: accountIdPresent
        ? []
        : [
            "CLOUDFLARE_ACCOUNT_ID is recommended for non-interactive Wrangler deploys.",
          ],
    };
  }

  if (process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_EMAIL) {
    hints.push(
      "API Key + Email works but API Token with least privilege is preferred.",
    );
    return {
      mode: "api_key_email",
      label: "CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL present",
      configured: true,
      accountIdPresent,
      hints,
    };
  }

  const home = process.env.USERPROFILE ?? process.env.HOME;
  if (home) {
    const candidates = [
      join(home, ".wrangler", "config", "default.toml"),
      join(home, ".config", ".wrangler", "config", "default.toml"),
    ];
    if (candidates.some((p) => existsSync(p))) {
      return {
        mode: "wrangler_oauth",
        label: "wrangler OAuth config detected (may be expired)",
        configured: true,
        accountIdPresent,
        hints: [
          "OAuth sessions can expire. Prefer CLOUDFLARE_API_TOKEN for CI.",
        ],
      };
    }
  }

  return {
    mode: "none",
    label: "not configured",
    configured: false,
    accountIdPresent,
    hints: [
      "Set CLOUDFLARE_API_TOKEN (Workers Scripts:Edit) and CLOUDFLARE_ACCOUNT_ID,",
      "or run `npx wrangler login` for interactive use.",
      "Without credentials, remote/preview return REMOTE_NOT_CONFIGURED.",
    ],
  };
}

export function remoteNotConfiguredMessage(context: string): string {
  return [
    "REMOTE_NOT_CONFIGURED",
    "",
    `Cloudflare authentication is unavailable for ${context}.`,
    "",
    "Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID,",
    "or run `npx wrangler login`.",
    "",
    "EdgeMirror will not invent remote or preview results.",
  ].join("\n");
}
