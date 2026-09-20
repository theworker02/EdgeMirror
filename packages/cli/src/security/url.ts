/**
 * URL / SSRF guards for parity requests and preview bases.
 *
 * `new URL(path, base)` treats absolute and scheme-relative paths as full URLs,
 * which would send EdgeMirror's fetch() to attacker-controlled hosts.
 */

export class UrlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UrlSafetyError";
  }
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
]);

/** IPv4 literals in private / link-local / loopback ranges. */
export function isBlockedIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const parts = m.slice(1).map(Number);
  if (parts.some((n) => n > 255)) return true;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host === "::1" || host === "[::1]" || host.startsWith("fe80:")) return true;
  if (isBlockedIpv4(host)) return true;
  return false;
}

/**
 * Normalize a Worker request path so it can only target `baseUrl`.
 * Accepts `/path`, `path`, and query strings; rejects absolute URLs.
 */
export function sanitizeRequestPath(requestPath: string): string {
  const raw = (requestPath ?? "").trim();
  if (!raw) return "/";
  if (/[\0\r\n]/.test(raw)) {
    throw new UrlSafetyError("Request path contains illegal characters");
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
    throw new UrlSafetyError(`Absolute URL not allowed as request path: ${raw}`);
  }
  if (raw.startsWith("//")) {
    throw new UrlSafetyError(`Scheme-relative URL not allowed as request path: ${raw}`);
  }
  if (raw.includes("\\")) {
    throw new UrlSafetyError("Backslash not allowed in request path");
  }
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  // Collapse accidental multi-slashes after the first.
  return withSlash.replace(/\/{2,}/g, "/");
}

/**
 * Resolve a Worker request against an EdgeMirror-controlled base URL.
 */
export function resolveWorkerRequestUrl(baseUrl: string, requestPath: string): URL {
  const base = new URL(baseUrl);
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new UrlSafetyError(`Unsupported base URL protocol: ${base.protocol}`);
  }
  const path = sanitizeRequestPath(requestPath);
  const url = new URL(path, base);
  if (url.origin !== base.origin) {
    throw new UrlSafetyError(
      `Request path escaped execution origin (${base.origin} → ${url.origin})`,
    );
  }
  return url;
}

const DEFAULT_PREVIEW_HOST_SUFFIXES = [".workers.dev", ".cloudflareworkers.com"];

export interface PreviewUrlPolicy {
  /** Extra hostname suffixes allowed beyond Cloudflare defaults. */
  allowedHostSuffixes?: string[];
  /** Allow http://127.0.0.1 for local-only tests (never for remote preview). */
  allowLoopback?: boolean;
}

/**
 * Validate a user-supplied preview/base URL before fetch.
 */
export function assertAllowedPreviewUrl(
  input: string,
  policy: PreviewUrlPolicy = {},
): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlSafetyError(`Invalid preview URL: ${input}`);
  }

  if (url.protocol !== "https:" && !(policy.allowLoopback && url.protocol === "http:")) {
    throw new UrlSafetyError(`Preview URL must use https (got ${url.protocol})`);
  }

  const host = url.hostname.toLowerCase();
  if (policy.allowLoopback && (host === "127.0.0.1" || host === "localhost")) {
    return url.toString().replace(/\/$/, "");
  }

  if (isBlockedHostname(host)) {
    throw new UrlSafetyError(`Preview host is blocked: ${host}`);
  }

  const suffixes = [
    ...DEFAULT_PREVIEW_HOST_SUFFIXES,
    ...(policy.allowedHostSuffixes ?? []),
  ];
  const allowed = suffixes.some(
    (suffix) => host === suffix.replace(/^\./, "") || host.endsWith(suffix),
  );
  if (!allowed) {
    throw new UrlSafetyError(
      `Preview host not on allowlist: ${host}. Expected *.workers.dev (or configured suffix).`,
    );
  }

  return url.toString().replace(/\/$/, "");
}
