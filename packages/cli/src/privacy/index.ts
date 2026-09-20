/**
 * Secret redaction before persistence.
 * Prefer failing closed: redact known secret shapes from traces and reports.
 */

const DEFAULT_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: "bearer-token", regex: /Bearer\s+[A-Za-z0-9._\-+=/]+/gi },
  { name: "authorization-header", regex: /(authorization["']?\s*[:=]\s*["']?)[^"',\s]+/gi },
  { name: "api-key-header", regex: /((?:x-)?api[-_]?key["']?\s*[:=]\s*["']?)[^"',\s]+/gi },
  { name: "aws-access-key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: "private-key-block", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "cf-api-token-env", regex: /(CLOUDFLARE_API_TOKEN["']?\s*[:=]\s*["']?)[^"',\s]+/gi },
  { name: "cf-api-key-env", regex: /(CLOUDFLARE_API_KEY["']?\s*[:=]\s*["']?)[^"',\s]+/gi },
  { name: "edgemirror-runner-token", regex: /\bemr_[a-f0-9]+\.[A-Za-z0-9_-]+\b/g },
  { name: "edgemirror-entitlement", regex: /\bem1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g },
  { name: "stripe-secret-key", regex: /\bsk_(?:live|test)_[A-Za-z0-9]+\b/g },
  { name: "github-pat", regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
];

export interface RedactionResult {
  value: string;
  redactions: string[];
}

export function redactString(
  input: string,
  extraPatterns: string[] = [],
): RedactionResult {
  let value = input;
  const redactions: string[] = [];

  for (const pattern of DEFAULT_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(value)) {
      pattern.regex.lastIndex = 0;
      value = value.replace(pattern.regex, (match, group1) => {
        // Preserve capture group prefixes (header names) when present.
        if (typeof group1 === "string" && match.startsWith(group1)) {
          return `${group1}[REDACTED]`;
        }
        return "[REDACTED]";
      });
      redactions.push(pattern.name);
    }
    pattern.regex.lastIndex = 0;
  }

  for (const raw of extraPatterns) {
    if (raw.length > 200) continue; // ignore pathological custom patterns
    try {
      const re = new RegExp(raw, "gi");
      re.lastIndex = 0;
      if (re.test(value)) {
        re.lastIndex = 0;
        value = value.replace(re, "[REDACTED]");
        redactions.push(`custom:${raw}`);
      }
    } catch {
      // ignore invalid user patterns
    }
  }

  return { value, redactions: [...new Set(redactions)] };
}

export function redactDeep<T>(value: T, extraPatterns: string[] = []): {
  value: T;
  redactions: string[];
} {
  const redactions: string[] = [];

  const walk = (node: unknown): unknown => {
    if (typeof node === "string") {
      const result = redactString(node, extraPatterns);
      redactions.push(...result.redactions);
      return result.value;
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node && typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  return {
    value: walk(value) as T,
    redactions: [...new Set(redactions)],
  };
}
