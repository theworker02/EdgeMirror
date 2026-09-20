/**
 * Incremental / --fast test selection.
 * Honest stubs: --nightly expands; --fast narrows; never fabricates coverage claims.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import type { ParityTest } from "../trace/schema.js";
import { priorityForTest } from "./dag.js";
import {
  ContentAddressedCache,
  defaultCacheDir,
  hashProjectSources,
} from "./cache.js";

export type SelectionMode = "full" | "fast" | "incremental" | "nightly";

export interface SelectionResult {
  mode: SelectionMode;
  selected: ParityTest[];
  skipped: ParityTest[];
  reason: string;
  /** Content hash used for incremental decisions — not evidence */
  sourceHash?: string;
  /** Estimates only */
  estimateNote: string;
}

const FAST_IDS = new Set([
  "http-get-root",
  "http-get-health",
]);

export function selectForMode(
  all: ParityTest[],
  mode: SelectionMode,
  opts?: { projectRoot?: string; cacheDir?: string },
): SelectionResult {
  if (mode === "full" || mode === "nightly") {
    // Nightly currently equals full locally; labeled honestly.
    return {
      mode,
      selected: [...all],
      skipped: [],
      reason:
        mode === "nightly"
          ? "Nightly mode currently selects the full corpus (no expanded fuzz corpus wired yet)."
          : "Full corpus selection.",
      estimateNote: "Selection only — does not claim coverage percentage.",
    };
  }

  if (mode === "fast") {
    const selected = all
      .filter((t) => FAST_IDS.has(t.id) || priorityForTest(t.id) === 0)
      .sort((a, b) => priorityForTest(a.id) - priorityForTest(b.id));
    const selIds = new Set(selected.map((t) => t.id));
    // Ensure at least one test
    const finalSel =
      selected.length > 0
        ? selected
        : all.slice().sort((a, b) => priorityForTest(a.id) - priorityForTest(b.id)).slice(0, 1);
    const skipped = all.filter((t) => !selIds.has(t.id) && !finalSel.includes(t));
    return {
      mode,
      selected: finalSel,
      skipped,
      reason:
        "Fast mode: time-to-confidence subset (root/health / P0). Not a substitute for full verify.",
      estimateNote: "Fewer tests → lower wall time expected; not a measured speedup claim.",
    };
  }

  // incremental
  const projectRoot = opts?.projectRoot ?? process.cwd();
  const sourceHash = hashWorkerTree(projectRoot);
  const cache = new ContentAddressedCache(
    opts?.cacheDir ?? defaultCacheDir(projectRoot),
  );
  const keyParts = [projectRoot, "incremental-v1"];
  const prev = cache.getByKey<{ sourceHash: string; testIds: string[] }>(
    cache.deriveKey("selection", keyParts),
  );

  let selected: ParityTest[];
  let reason: string;

  if (!prev.hit || prev.value.sourceHash !== sourceHash) {
    // Sources changed or first run — run P0+P1, cache new hash
    selected = all.filter((t) => priorityForTest(t.id) <= 1);
    if (selected.length === 0) selected = all.slice(0, Math.min(3, all.length));
    reason = prev.hit
      ? "Incremental: worker/source hash changed — re-running P0–P1 subset."
      : "Incremental: no prior selection cache — running P0–P1 subset.";
    cache.putStable("selection", keyParts, {
      sourceHash,
      testIds: selected.map((t) => t.id),
      gitHint: tryGitHint(projectRoot),
    });
  } else {
    // Unchanged sources — still run P0 smoke; skip heavier ids if previously recorded
    const prior = new Set(prev.value.testIds);
    selected = all.filter(
      (t) => priorityForTest(t.id) === 0 || prior.has(t.id),
    );
    if (selected.length === 0) selected = all.slice(0, 1);
    reason =
      "Incremental: source hash unchanged — P0 plus previously selected ids. Not a proof of full parity.";
  }

  const selIds = new Set(selected.map((t) => t.id));
  return {
    mode,
    selected,
    skipped: all.filter((t) => !selIds.has(t.id)),
    reason,
    sourceHash,
    estimateNote:
      "Incremental selection uses content hashes only; never reuses remote evidence.",
  };
}

function hashWorkerTree(projectRoot: string): string {
  const files: Array<{ path: string; contents: string }> = [];
  const candidates = [
    "src",
    "worker",
    "workers",
    "wrangler.toml",
    "wrangler.json",
    "wrangler.jsonc",
    "package.json",
  ];
  for (const c of candidates) {
    const abs = join(projectRoot, c);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (st.isFile()) {
      files.push({ path: c, contents: readFileSync(abs, "utf8") });
    } else if (st.isDirectory()) {
      walkFiles(abs, projectRoot, files, 200);
    }
  }
  if (files.length === 0) {
    return hashProjectSources([{ path: "empty", contents: projectRoot }]);
  }
  return hashProjectSources(files);
}

function walkFiles(
  dir: string,
  root: string,
  out: Array<{ path: string; contents: string }>,
  budget: number,
): void {
  if (out.length >= budget) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, root, out, budget);
    else if (/\.(ts|js|mjs|cjs|toml|json|jsonc|wasm)$/i.test(name)) {
      out.push({
        path: relative(root, abs).replace(/\\/g, "/"),
        contents: readFileSync(abs, "utf8"),
      });
      if (out.length >= budget) return;
    }
  }
}

function tryGitHint(projectRoot: string): string | undefined {
  try {
    return execSync("git diff --name-only HEAD", {
      cwd: projectRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    })
      .trim()
      .slice(0, 2000);
  } catch {
    return undefined;
  }
}
