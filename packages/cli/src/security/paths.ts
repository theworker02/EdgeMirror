/**
 * Path containment — prevent corpus/config reads outside the project root.
 */

import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

export class PathEscapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathEscapeError";
  }
}

/**
 * Resolve `candidate` under `root` and reject traversal / absolute escapes.
 */
export function resolveContained(root: string, candidate: string): string {
  const rootResolved = resolve(root);
  const target = isAbsolute(candidate)
    ? resolve(candidate)
    : resolve(rootResolved, candidate);
  const rel = relative(rootResolved, target);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathEscapeError(
      `Path escapes project root: ${candidate} (resolved ${target})`,
    );
  }
  // Normalize for consistent comparisons on Windows.
  return normalize(target);
}

export function assertPathInside(root: string, absolutePath: string): void {
  resolveContained(root, absolutePath);
}

/** True when `child` is equal to or nested under `parent`. */
export function isPathInside(parent: string, child: string): boolean {
  try {
    resolveContained(parent, child);
    return true;
  } catch {
    return false;
  }
}

/** Reject null bytes and control characters in user-supplied path segments. */
export function assertSafePathSegment(segment: string): void {
  if (!segment || /[\0\r\n]/.test(segment)) {
    throw new PathEscapeError("Invalid path segment");
  }
  if (segment.includes(`..${sep}`) || segment === ".." || segment.includes(`${sep}..`)) {
    throw new PathEscapeError(`Unsafe path segment: ${segment}`);
  }
}
