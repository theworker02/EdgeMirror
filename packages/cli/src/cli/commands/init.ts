import type { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureArtifactsDir,
  resolveProjectRoot,
  writeDefaultConfig,
} from "../../config/index.js";
import {
  GITHUB_WORKFLOW_YAML,
  GITLAB_CI_YAML,
  WORKERS_BUILDS_HINT,
} from "../../integrations/ci-scaffolds.js";

export type CiProvider = "github" | "gitlab" | "workers-builds" | "unknown";

export function detectCiProvider(root: string): CiProvider {
  if (
    existsSync(join(root, ".github")) ||
    process.env.GITHUB_ACTIONS === "true"
  ) {
    return "github";
  }
  if (
    existsSync(join(root, ".gitlab-ci.yml")) ||
    process.env.GITLAB_CI === "true"
  ) {
    return "gitlab";
  }
  if (
    existsSync(join(root, "wrangler.toml")) ||
    existsSync(join(root, "wrangler.jsonc")) ||
    existsSync(join(root, "wrangler.json"))
  ) {
    // Workers Builds is Cloudflare-hosted CI — emit a hint file, not a fake workflow
    return "workers-builds";
  }
  return "unknown";
}

function writeCiScaffold(
  root: string,
  provider: CiProvider,
  force: boolean,
): void {
  if (provider === "github" || provider === "unknown") {
    const workflowDir = join(root, ".github", "workflows");
    const workflowPath = join(workflowDir, "edgemirror-verify.yml");
    if (existsSync(workflowPath) && !force) {
      console.log(
        `GitHub workflow already exists: ${workflowPath} (use --force to overwrite)`,
      );
    } else {
      mkdirSync(workflowDir, { recursive: true });
      writeFileSync(workflowPath, GITHUB_WORKFLOW_YAML, "utf8");
      console.log(`Wrote ${workflowPath}`);
    }
    return;
  }

  if (provider === "gitlab") {
    const path = join(root, ".gitlab-ci.yml");
    if (existsSync(path) && !force) {
      console.log(
        `GitLab CI already exists: ${path} (use --force to overwrite, or merge manually)`,
      );
      const snippet = join(root, ".edgemirror", "gitlab-ci.edgemirror.yml");
      mkdirSync(join(root, ".edgemirror"), { recursive: true });
      writeFileSync(snippet, GITLAB_CI_YAML, "utf8");
      console.log(`Wrote snippet ${snippet} — merge into your .gitlab-ci.yml`);
    } else {
      writeFileSync(path, GITLAB_CI_YAML, "utf8");
      console.log(`Wrote ${path}`);
    }
    return;
  }

  if (provider === "workers-builds") {
    const path = join(root, ".edgemirror", "workers-builds.md");
    mkdirSync(join(root, ".edgemirror"), { recursive: true });
    writeFileSync(path, WORKERS_BUILDS_HINT, "utf8");
    console.log(`Wrote ${path}`);
    console.log(
      "Workers Builds: configure a build command that runs `npx edgemirror verify --local --ci`",
    );
  }
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize EdgeMirror config and artifact directories")
    .option("--github", "Also scaffold a GitHub Actions verify workflow")
    .option(
      "--ci",
      "Detect CI provider (GitHub Actions / GitLab / Workers Builds) and scaffold",
    )
    .option("--force", "Overwrite existing workflow if present")
    .action((opts: { github?: boolean; ci?: boolean; force?: boolean }) => {
      const root = resolveProjectRoot();
      const configPath = writeDefaultConfig(root);
      const artifacts = ensureArtifactsDir(root);
      console.log(`Wrote ${configPath}`);
      console.log(`Artifacts directory: ${artifacts}`);

      if (opts.ci) {
        const provider = detectCiProvider(root);
        console.log(`Detected CI context: ${provider}`);
        writeCiScaffold(root, provider, Boolean(opts.force));
      } else if (opts.github) {
        writeCiScaffold(root, "github", Boolean(opts.force));
      }

      console.log("");
      console.log("Next:");
      console.log("  edgemirror doctor");
      console.log("  edgemirror verify --local");
    });
}
