import type { Command } from "commander";
import { resolveProjectRoot } from "../../config/index.js";
import { createEvidenceBundle, verifyBundle } from "../../bundle/index.js";

export function registerBundleCommand(program: Command): void {
  program
    .command("bundle")
    .description("Create a portable evidence bundle for EM-### or a run id")
    .argument("<id>", "Finding id (EM-001) or run id")
    .action((id: string) => {
      const root = resolveProjectRoot();
      const { bundleDir, manifest } = createEvidenceBundle({
        projectRoot: root,
        targetId: id,
      });
      const check = verifyBundle(bundleDir);
      console.log(`Evidence bundle: ${bundleDir}`);
      console.log(`Files: ${manifest.files.length}`);
      console.log(`Integrity: ${check.ok ? "ok" : `issues: ${check.missing.join(", ")}`}`);
      if (!check.ok) process.exitCode = 2;
    });
}
