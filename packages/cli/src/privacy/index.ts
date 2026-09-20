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
    if (pattern.regex.test(value)) {
      pattern.regex.lastIndex = 0;
      value = value.replace(pattern.regex, "[REDACTED]");
      redactions.push(pattern.name);
    }
    pattern.regex.lastIndex = 0;
  }

  for (const raw of extraPatterns) {
    try {
      const re = new RegExp(raw, "gi");
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
