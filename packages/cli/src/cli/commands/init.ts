import type { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureArtifactsDir,
  resolveProjectRoot,
  writeDefaultConfig,
} from "../../config/index.js";
import { GITHUB_WORKFLOW_YAML } from "../../integrations/github-workflow.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize EdgeMirror config and artifact directories")
    .option("--github", "Also scaffold a GitHub Actions verify workflow")
    .option("--force", "Overwrite existing workflow if present")
    .action((opts: { github?: boolean; force?: boolean }) => {
      const root = resolveProjectRoot();
      const configPath = writeDefaultConfig(root);
      const artifacts = ensureArtifactsDir(root);
      console.log(`Wrote ${configPath}`);
      console.log(`Artifacts directory: ${artifacts}`);

      if (opts.github) {
        const workflowDir = join(root, ".github", "workflows");
        const workflowPath = join(workflowDir, "edgemirror-verify.yml");
        if (existsSync(workflowPath) && !opts.force) {
          console.log(`GitHub workflow already exists: ${workflowPath} (use --force to overwrite)`);
        } else {
          mkdirSync(workflowDir, { recursive: true });
          writeFileSync(workflowPath, GITHUB_WORKFLOW_YAML, "utf8");
          console.log(`Wrote ${workflowPath}`);
        }
      }

      console.log("");
      console.log("Next:");
      console.log("  edgemirror doctor");
      console.log("  edgemirror verify");
    });
}
