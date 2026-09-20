/**
 * Content-addressed cache for *safe* Supercharger artifacts.
 *
 * NEVER store or replay remote parity evidence / classifications as verified.
 * Allowed: selection plans, content hashes, local-only fingerprints marked as such,
 * scheduler plans, resource snapshots.
 */

import {
  createHash,
  type BinaryLike,
} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export type CacheKind =
  | "selection"
  | "plan"
  | "local_fingerprint"
  | "resource_snapshot"
  | "bundle_hash"
  | "matrix_prune";

/** Kinds that must never be treated as remote verification evidence. */
export const FORBIDDEN_EVIDENCE_KINDS = new Set([
  "parity_result",
  "remote_trace",
  "remote_evidence",
  "classification",
]);

export interface CacheEntryMeta {
  key: string;
  kind: CacheKind;
  createdAt: string;
  /** Explicit: this entry is not remote verification */
  notRemoteEvidence: true;
}

export class ContentAddressedCache {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
    mkdirSync(join(root, "blobs"), { recursive: true });
    mkdirSync(join(root, "meta"), { recursive: true });
  }

  static hash(parts: BinaryLike[]): string {
    const h = createHash("sha256");
    for (const p of parts) h.update(p);
    return h.digest("hex");
  }

  pathFor(key: string): string {
    return join(this.root, "blobs", key.slice(0, 2), key);
  }

  metaPath(key: string): string {
    return join(this.root, "meta", `${key}.json`);
  }

  put(
    kind: CacheKind,
    payload: unknown,
    keyParts: BinaryLike[],
  ): { key: string; path: string } {
    if ((FORBIDDEN_EVIDENCE_KINDS as Set<string>).has(kind)) {
      throw new Error(
        `Refusing to cache ${kind}: would invalidate parity evidence integrity`,
      );
    }
    const key = ContentAddressedCache.hash([
      kind,
      ...keyParts,
      JSON.stringify(payload),
    ]);
    const path = this.pathFor(key);
    mkdirSync(join(this.root, "blobs", key.slice(0, 2)), { recursive: true });
    writeFileSync(path, JSON.stringify(payload), "utf8");
    const meta: CacheEntryMeta = {
      key,
      kind,
      createdAt: new Date().toISOString(),
      notRemoteEvidence: true,
    };
    writeFileSync(this.metaPath(key), JSON.stringify(meta, null, 2), "utf8");
    return { key, path };
  }

  /**
   * Lookup by deterministic key parts (without payload).
   * Caller must use `put`/`getByKey` consistently via `deriveKey`.
   */
  deriveKey(kind: CacheKind, keyParts: BinaryLike[]): string {
    return ContentAddressedCache.hash([kind, ...keyParts]);
  }

  getByKey<T>(key: string): { hit: false } | { hit: true; value: T; meta: CacheEntryMeta } {
    const path = this.pathFor(key);
    const metaFile = this.metaPath(key);
    if (!existsSync(path) || !existsSync(metaFile)) return { hit: false };
    const meta = JSON.parse(readFileSync(metaFile, "utf8")) as CacheEntryMeta;
    if (!meta.notRemoteEvidence) {
      throw new Error("Corrupt cache meta: missing notRemoteEvidence marker");
    }
    if ((FORBIDDEN_EVIDENCE_KINDS as Set<string>).has(meta.kind)) {
      throw new Error(`Refusing to read forbidden cache kind ${meta.kind}`);
    }
    const value = JSON.parse(readFileSync(path, "utf8")) as T;
    return { hit: true, value, meta };
  }

  /** Store under a stable key derived from kind+parts only (payload not in key). */
  putStable(
    kind: CacheKind,
    keyParts: BinaryLike[],
    payload: unknown,
  ): { key: string; path: string } {
    if ((FORBIDDEN_EVIDENCE_KINDS as Set<string>).has(kind)) {
      throw new Error(
        `Refusing to cache ${kind}: would invalidate parity evidence integrity`,
      );
    }
    const key = this.deriveKey(kind, keyParts);
    const path = this.pathFor(key);
    mkdirSync(join(this.root, "blobs", key.slice(0, 2)), { recursive: true });
    writeFileSync(path, JSON.stringify(payload), "utf8");
    const meta: CacheEntryMeta = {
      key,
      kind,
      createdAt: new Date().toISOString(),
      notRemoteEvidence: true,
    };
    writeFileSync(this.metaPath(key), JSON.stringify(meta, null, 2), "utf8");
    return { key, path };
  }

  stats(): { entries: number; bytes: number } {
    let entries = 0;
    let bytes = 0;
    const blobs = join(this.root, "blobs");
    if (!existsSync(blobs)) return { entries: 0, bytes: 0 };
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p);
        else {
          entries += 1;
          bytes += st.size;
        }
      }
    };
    walk(blobs);
    return { entries, bytes };
  }
}

export function defaultCacheDir(projectRoot: string): string {
  return join(projectRoot, ".edgemirror", "supercharger-cache");
}

/** Hash worker sources for incremental selection — not evidence. */
export function hashProjectSources(
  files: Array<{ path: string; contents: string | Buffer }>,
): string {
  const h = createHash("sha256");
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const f of sorted) {
    h.update(f.path);
    h.update("\0");
    h.update(f.contents);
    h.update("\0");
  }
  return h.digest("hex");
}
