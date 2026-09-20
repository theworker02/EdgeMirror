/**
 * Evidence bundle — portable .edgemirror artifact for a finding or run.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { artifactsDir } from "../config/index.js";
import { EDGEMIRROR_VERSION } from "../version.js";

export interface BundleManifest {
  schemaVersion: "1.0";
  edgemirrorVersion: string;
  createdAt: string;
  targetId: string;
  kind: "finding" | "run";
  files: Array<{ path: string; sha256: string; bytes: number }>;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function collectFiles(dir: string, base: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(full, base));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Create a portable evidence directory (zip-like folder with manifest).
 * Writes to `.edgemirror/bundles/<id>.edgemirror/`.
 */
export function createEvidenceBundle(input: {
  projectRoot: string;
  targetId: string;
}): { bundleDir: string; manifest: BundleManifest } {
  const root = artifactsDir(input.projectRoot);
  const targetId = input.targetId;
  const bundlesDir = join(root, "bundles");
  mkdirSync(bundlesDir, { recursive: true });

  const bundleDir = join(bundlesDir, `${targetId}.edgemirror`);
  mkdirSync(bundleDir, { recursive: true });

  const filesToCopy: Array<{ src: string; destRel: string }> = [];

  // Finding receipt EM-###
  const receiptCandidates = [
    join(root, "receipts", `${targetId}.json`),
    ...findInRuns(root, "receipts", `${targetId}.json`),
  ];
  for (const src of receiptCandidates) {
    if (existsSync(src)) {
      filesToCopy.push({ src, destRel: join("receipts", `${targetId}.json`) });
    }
  }

  // Run directory
  const runDir = join(root, "runs", targetId);
  if (existsSync(runDir)) {
    for (const f of collectFiles(runDir, runDir)) {
      filesToCopy.push({ src: f, destRel: join("run", relative(runDir, f)) });
    }
  }

  // Also search receipts inside runs for finding id and pull sibling traces
  for (const run of listRunDirs(root)) {
    const receipt = join(run, "receipts", `${targetId}.json`);
    if (existsSync(receipt)) {
      filesToCopy.push({
        src: receipt,
        destRel: join("receipts", `${targetId}.json`),
      });
      try {
        const data = JSON.parse(readFileSync(receipt, "utf8")) as {
          artifactPaths?: string[];
        };
        for (const ap of data.artifactPaths ?? []) {
          if (existsSync(ap)) {
            filesToCopy.push({
              src: ap,
              destRel: join("traces", ap.split(/[/\\]/).pop()!),
            });
          }
        }
      } catch {
        /* ignore */
      }
      // include run summary if present
      const summary = join(run, "summary.json");
      if (existsSync(summary)) {
        filesToCopy.push({ src: summary, destRel: "summary.json" });
      }
    }
  }

  if (filesToCopy.length === 0) {
    throw new Error(
      `No evidence found for '${targetId}'. Expected a finding like EM-001 or a run id under .edgemirror/runs/.`,
    );
  }

  const manifestFiles: BundleManifest["files"] = [];
  const seen = new Set<string>();

  for (const item of filesToCopy) {
    if (seen.has(item.destRel)) continue;
    seen.add(item.destRel);
    const dest = join(bundleDir, item.destRel);
    mkdirSync(join(dest, ".."), { recursive: true });
    const buf = readFileSync(item.src);
    writeFileSync(dest, buf);
    manifestFiles.push({
      path: item.destRel.replace(/\\/g, "/"),
      sha256: sha256File(dest),
      bytes: buf.length,
    });
  }

  const kind: BundleManifest["kind"] = targetId.startsWith("EM-")
    ? "finding"
    : "run";

  const manifest: BundleManifest = {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    createdAt: new Date().toISOString(),
    targetId,
    kind,
    files: manifestFiles,
  };

  writeFileSync(
    join(bundleDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  // Also write a single-file archive marker (directory bundle; zip optional later)
  writeFileSync(
    join(bundlesDir, `${targetId}.edgemirror.json`),
    JSON.stringify(
      { bundleDir, manifest, note: "Portable evidence directory bundle" },
      null,
      2,
    ),
    "utf8",
  );

  return { bundleDir, manifest };
}

function listRunDirs(root: string): string[] {
  const runs = join(root, "runs");
  if (!existsSync(runs)) return [];
  return readdirSync(runs, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => join(runs, d.name));
}

function findInRuns(root: string, sub: string, fileName: string): string[] {
  return listRunDirs(root)
    .map((run) => join(run, sub, fileName))
    .filter((p) => existsSync(p));
}

/** Minimal tar-like listing helper for tests (no compression dependency). */
export function verifyBundle(bundleDir: string): {
  ok: boolean;
  missing: string[];
} {
  const manifestPath = join(bundleDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, missing: ["manifest.json"] };
  }
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as BundleManifest;
  const missing: string[] = [];
  for (const f of manifest.files) {
    const p = join(bundleDir, f.path);
    if (!existsSync(p)) {
      missing.push(f.path);
      continue;
    }
    if (sha256File(p) !== f.sha256) {
      missing.push(`${f.path} (hash mismatch)`);
    }
  }
  return { ok: missing.length === 0, missing };
}
