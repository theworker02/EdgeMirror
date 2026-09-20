/**
 * Built-in parity corpus and fixture loading.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ParityTest } from "../trace/schema.js";

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

export function loadCorpusFromPath(path: string): ParityTest[] {
  if (!existsSync(path)) return [];
  const raw = JSON.parse(readFileSync(path, "utf8")) as
    | ParityTest[]
    | { tests: ParityTest[] };
  return Array.isArray(raw) ? raw : raw.tests ?? [];
}

export function loadCorpusPaths(paths: string[]): ParityTest[] {
  const tests: ParityTest[] = [];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    // directory of json files or single file
    try {
      const stat = readdirSync(p, { withFileTypes: true });
      for (const entry of stat) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
          tests.push(...loadCorpusFromPath(join(p, entry.name)));
        }
      }
    } catch {
      tests.push(...loadCorpusFromPath(p));
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
}): ParityTest[] {
  const tests: ParityTest[] = [];
  if (input.includeBuiltin) {
    tests.push(...BUILTIN_CORPUS);
  }
  if (input.paths?.length) {
    tests.push(...loadCorpusPaths(input.paths));
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
