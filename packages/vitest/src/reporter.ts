/**
 * EdgeMirror Vitest reporter — intentionally loosely typed so it does not
 * hard-depend on Vitest internals across versions.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface VitestLike {
  config?: { root?: string };
  state?: { filesMap?: Map<string, unknown[]> };
}

export class EdgeMirrorVitestReporter {
  private ctx?: VitestLike;

  onInit(ctx: VitestLike): void {
    this.ctx = ctx;
  }

  onFinished(): void {
    const root = this.ctx?.config?.root ?? process.cwd();
    const outDir = join(root, ".edgemirror", "vitest");
    mkdirSync(outDir, { recursive: true });
    const files = this.ctx?.state?.filesMap
      ? [...this.ctx.state.filesMap.values()].flat()
      : [];
    const summary = {
      adapter: "edgemirror-vitest",
      schemaVersion: "1.0",
      finishedAt: new Date().toISOString(),
      fileCount: files.length,
      note: "EdgeMirror Vitest adapter records outcomes only; use @cloudflare/vitest-pool-workers for Worker execution.",
    };
    writeFileSync(join(outDir, "last-run.json"), JSON.stringify(summary, null, 2));
  }
}

export default EdgeMirrorVitestReporter;
