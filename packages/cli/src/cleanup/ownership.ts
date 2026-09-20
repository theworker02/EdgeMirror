import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type OwnedResourceType =
  | "worker"
  | "d1"
  | "r2"
  | "kv"
  | "queue"
  | "other";

export interface OwnedResource {
  id: string;
  type: OwnedResourceType;
  name: string;
  createdAt: string;
  cleanedAt?: string;
  edgemirrorOwned: true;
  metadata: Record<string, unknown>;
}

export function claimResource(input: {
  ownershipDir: string;
  type: OwnedResourceType;
  name: string;
  metadata?: Record<string, unknown>;
}): OwnedResource {
  mkdirSync(input.ownershipDir, { recursive: true });
  const resource: OwnedResource = {
    id: randomUUID(),
    type: input.type,
    name: input.name,
    createdAt: new Date().toISOString(),
    edgemirrorOwned: true,
    metadata: input.metadata ?? {},
  };
  writeFileSync(
    join(input.ownershipDir, `${resource.id}.json`),
    JSON.stringify(resource, null, 2),
    "utf8",
  );
  return resource;
}

export function listOwnedResources(ownershipDir: string): OwnedResource[] {
  if (!existsSync(ownershipDir)) return [];
  return readdirSync(ownershipDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(readFileSync(join(ownershipDir, f), "utf8")) as OwnedResource;
      return raw;
    })
    .filter((r) => r.edgemirrorOwned === true);
}

/**
 * Only deletes resources EdgeMirror can prove it owns via ownership markers.
 */
export async function cleanupOwnedResources(
  ownershipDir: string,
  deleter: (resource: OwnedResource) => Promise<boolean>,
): Promise<{ cleaned: string[]; skipped: string[]; failed: string[] }> {
  const owned = listOwnedResources(ownershipDir);
  const cleaned: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const resource of owned) {
    if (resource.cleanedAt) {
      skipped.push(`${resource.type}:${resource.name} (already cleaned)`);
      continue;
    }
    try {
      const ok = await deleter(resource);
      if (ok) {
        resource.cleanedAt = new Date().toISOString();
        writeFileSync(
          join(ownershipDir, `${resource.id}.json`),
          JSON.stringify(resource, null, 2),
        );
        cleaned.push(`${resource.type}:${resource.name}`);
      } else {
        failed.push(`${resource.type}:${resource.name}`);
      }
    } catch {
      failed.push(`${resource.type}:${resource.name}`);
    }
  }

  return { cleaned, skipped, failed };
}
