/**
 * Ownership-safe cleanup of EdgeMirror-created Cloudflare resources.
 */

import { join } from "node:path";
import {
  cleanupOwnedResources,
  listOwnedResources,
  type OwnedResource,
} from "./ownership.js";
import { runWrangler } from "../adapters/cloudflare/wrangler.js";
import { detectCloudflareAuth } from "../adapters/cloudflare/auth.js";
import { ensureArtifactsDir } from "../config/index.js";
import { discoverProject, EdgeMirrorDiscoveryError } from "../discovery/index.js";

export interface DemoResetResult {
  cleaned: string[];
  skipped: string[];
  failed: string[];
  ownershipDir: string;
  authConfigured: boolean;
}

async function deleteCloudflareResource(
  projectRoot: string,
  resource: OwnedResource,
): Promise<boolean> {
  if (resource.type === "worker") {
    const del = await runWrangler(
      ["delete", resource.name, "--force"],
      projectRoot,
    );
    return del.code === 0;
  }
  // Non-worker resources: EdgeMirror currently only claims workers.
  // Refuse to delete anything we cannot safely address.
  return false;
}

/**
 * Clean up resources EdgeMirror can prove it owns via ownership markers.
 * Never deletes unmarked Cloudflare resources.
 */
export async function resetDemoResources(opts: {
  cwd?: string;
  ownershipDir?: string;
  quiet?: boolean;
}): Promise<DemoResetResult> {
  const auth = detectCloudflareAuth();
  let projectRoot = opts.cwd ?? process.cwd();
  let ownershipDir = opts.ownershipDir;

  try {
    const discovered = discoverProject(projectRoot);
    projectRoot = discovered.projectRoot;
    const artifacts = ensureArtifactsDir(projectRoot);
    ownershipDir = ownershipDir ?? join(artifacts, "ownership");
  } catch (err) {
    if (err instanceof EdgeMirrorDiscoveryError) {
      // Allow reset against an explicit ownership dir without wrangler project
      if (!ownershipDir) {
        ownershipDir = join(projectRoot, ".edgemirror", "ownership");
      }
    } else {
      throw err;
    }
  }

  const owned = listOwnedResources(ownershipDir);
  if (!opts.quiet) {
    console.log(`EdgeMirror demo reset`);
    console.log(`  ownership dir: ${ownershipDir}`);
    console.log(`  marked resources: ${owned.length}`);
    console.log(`  auth: ${auth.label}`);
  }

  if (owned.length === 0) {
    if (!opts.quiet) {
      console.log("  Nothing to clean — no EdgeMirror ownership markers found.");
    }
    return {
      cleaned: [],
      skipped: [],
      failed: [],
      ownershipDir,
      authConfigured: auth.configured,
    };
  }

  if (!auth.configured) {
    if (!opts.quiet) {
      console.log(
        "  REMOTE_NOT_CONFIGURED — cannot delete remote Workers without credentials.",
      );
      console.log(
        "  Ownership markers are retained. Set CLOUDFLARE_API_TOKEN and re-run.",
      );
    }
    return {
      cleaned: [],
      skipped: owned.map((r) => `${r.type}:${r.name} (no credentials)`),
      failed: [],
      ownershipDir,
      authConfigured: false,
    };
  }

  const result = await cleanupOwnedResources(ownershipDir, (resource) =>
    deleteCloudflareResource(projectRoot, resource),
  );

  if (!opts.quiet) {
    for (const c of result.cleaned) console.log(`  cleaned: ${c}`);
    for (const s of result.skipped) console.log(`  skipped: ${s}`);
    for (const f of result.failed) console.log(`  failed:  ${f}`);
  }

  return { ...result, ownershipDir, authConfigured: true };
}
