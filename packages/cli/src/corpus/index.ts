/**
 * Built-in parity corpus and fixture loading.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParityTest } from "../trace/schema.js";
import { PathEscapeError, resolveContained } from "../security/paths.js";
import { sanitizeRequestPath, UrlSafetyError } from "../security/url.js";
import { assertRequestBodySize } from "../security/limits.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const BUILTIN_CORPUS: ParityTest[] = [
  {
    id: "http-get-root",
    name: "GET / returns 200",
    description: "Basic HTTP GET against worker root",
    feature: "http",
    category: "http",
    request: { method: "GET", path: "/" },
    expectedBehavior: "parity",
  },
  {
    id: "http-get-health",
    name: "GET /health",
    description: "Health endpoint when present",
    feature: "http",
    category: "http",
    request: { method: "GET", path: "/health" },
    expectedBehavior: "parity",
  },
  {
    id: "http-get-json",
    name: "GET /api/echo",
    description: "JSON echo endpoint",
    feature: "http",
    category: "http",
    request: { method: "GET", path: "/api/echo" },
    expectedBehavior: "parity",
  },
  {
    id: "http-post-echo",
    name: "POST /api/echo",
    description: "POST body echo",
    feature: "http",
    category: "http",
    request: {
      method: "POST",
      path: "/api/echo",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "edgemirror" }),
    },
    expectedBehavior: "parity",
  },
  {
    id: "http-not-found",
    name: "GET /__edgemirror_missing",
    description: "Missing path should match status locally and remotely",
    feature: "http",
    category: "http",
    request: { method: "GET", path: "/__edgemirror_missing" },
    expectedBehavior: "parity",
  },
];

function sanitizeLoadedTests(tests: ParityTest[]): ParityTest[] {
  return tests.map((t) => {
    try {
      const path = sanitizeRequestPath(t.request.path);
      assertRequestBodySize(t.request.body);
      return { ...t, request: { ...t.request, path } };
    } catch (err) {
      if (err instanceof UrlSafetyError) {
        throw new UrlSafetyError(`Corpus test ${t.id}: ${err.message}`);
      }
      throw err;
    }
  });
}

export function loadCorpusFromPath(path: string): ParityTest[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")) as
    | ParityTest[]
    | { tests: ParityTest[] };
  const tests = Array.isArray(raw) ? raw : raw.tests ?? [];
  return sanitizeLoadedTests(tests);
}

/**
 * Load corpus files. When `projectRoot` is set, paths must resolve inside it.
 */
export function loadCorpusPaths(
  paths: string[],
  projectRoot?: string,
): ParityTest[] {
  const tests: ParityTest[] = [];
  for (const p of paths) {
    let resolved = p;
    if (projectRoot) {
      try {
        resolved = resolveContained(projectRoot, p);
      } catch (err) {
        if (err instanceof PathEscapeError) {
          throw err;
        }
        throw err;
      }
    }
    if (!existsSync(resolved)) continue;
    // directory of json files or single file
    try {
      const stat = readdirSync(resolved, { withFileTypes: true });
      for (const entry of stat) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          const filePath = projectRoot
            ? resolveContained(projectRoot, join(resolved, entry.name))
            : join(resolved, entry.name);
          tests.push(...loadCorpusFromPath(filePath));
        }
      }
    } catch (err) {
      if (err instanceof PathEscapeError || err instanceof UrlSafetyError) {
        throw err;
      }
      tests.push(...loadCorpusFromPath(resolved));
    }
  }
  return tests;
}

export function resolveBuiltinCorpusDir(): string {
  return join(__dirname, "builtin");
}

export function selectTests(input: {
  includeBuiltin: boolean;
  paths?: string[];
  filter?: string;
  /** When set, corpus paths are constrained to this root. */
  projectRoot?: string;
}): ParityTest[] {
  const tests: ParityTest[] = [];
  if (input.includeBuiltin) {
    tests.push(...sanitizeLoadedTests(BUILTIN_CORPUS));
  }
  if (input.paths?.length) {
    tests.push(...loadCorpusPaths(input.paths, input.projectRoot));
  }
  if (!input.filter) return tests;
  const f = input.filter.toLowerCase();
  return tests.filter(
    (t) =>
      t.id.toLowerCase().includes(f) ||
      t.name.toLowerCase().includes(f) ||
      t.category?.toLowerCase().includes(f) ||
      t.feature?.toLowerCase().includes(f),
  );
}
