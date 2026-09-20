/**
 * Ownership marker hardening — cleanup may only touch edgemirror-tmp-* resources
 * with a valid marker shape (and optional HMAC when EDGEMIRROR_OWNERSHIP_SECRET set).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { OwnedResource, OwnedResourceType } from "../cleanup/ownership.js";

export class OwnershipGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OwnershipGuardError";
  }
}

export const TMP_WORKER_PREFIX = "edgemirror-tmp-";

const ALLOWED_TYPES: ReadonlySet<OwnedResourceType> = new Set([
  "worker",
  "d1",
  "r2",
  "kv",
  "queue",
  "other",
]);

export function isEdgeMirrorTempName(name: string, type: OwnedResourceType): boolean {
  if (type === "worker") {
    return name.startsWith(TMP_WORKER_PREFIX) && /^edgemirror-tmp-[a-f0-9]{8}$/.test(name);
  }
  return name.startsWith("edgemirror-tmp-");
}

export function ownershipMac(
  secret: string,
  resource: Pick<OwnedResource, "id" | "type" | "name" | "createdAt">,
): string {
  const payload = `${resource.id}:${resource.type}:${resource.name}:${resource.createdAt}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function attachOwnershipMac(
  resource: OwnedResource,
  secret: string | undefined = process.env.EDGEMIRROR_OWNERSHIP_SECRET,
): OwnedResource {
  if (!secret) return resource;
  return {
    ...resource,
    metadata: {
      ...resource.metadata,
      ownershipMac: ownershipMac(secret, resource),
    },
  };
}

/**
 * Validate a marker before destructive cleanup.
 */
export function assertOwnedResourceSafe(
  resource: OwnedResource,
  secret: string | undefined = process.env.EDGEMIRROR_OWNERSHIP_SECRET,
): void {
  if (resource.edgemirrorOwned !== true) {
    throw new OwnershipGuardError("Resource missing edgemirrorOwned marker");
  }
  if (!ALLOWED_TYPES.has(resource.type)) {
    throw new OwnershipGuardError(`Unknown resource type: ${resource.type}`);
  }
  if (!resource.name || typeof resource.name !== "string") {
    throw new OwnershipGuardError("Resource name required");
  }
  if (!isEdgeMirrorTempName(resource.name, resource.type)) {
    throw new OwnershipGuardError(
      `Refusing to clean non-EdgeMirror name: ${resource.name}`,
    );
  }
  if (!resource.id || !/^[0-9a-f-]{36}$/i.test(resource.id)) {
    throw new OwnershipGuardError("Resource id must be a UUID");
  }

  if (secret) {
    const mac = resource.metadata?.ownershipMac;
    if (typeof mac !== "string") {
      throw new OwnershipGuardError("Ownership MAC required but missing");
    }
    const expected = ownershipMac(secret, resource);
    const a = Buffer.from(mac, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new OwnershipGuardError("Ownership MAC mismatch");
    }
  }
}
