import type { Command } from "commander";
import { runParitySuite } from "../../orchestrator/index.js";
import type { ReportFormat } from "../../reporter/index.js";

export function registerTestCommand(program: Command): void {
  program
    .command("test")
    .description("Run local ↔ remote differential parity tests")
    .option("--local", "Local execution only (skip remote)")
    .option("--skip-remote", "Alias for --local")
    .option("--preview", "Compare local against preview URL instead of deploy")
    .option("--preview-url <url>", "Use an existing preview URL")
    .option("--filter <pattern>", "Filter corpus tests by id/name/category")
    .option("--ci", "CI exit codes (0 parity, 1 divergence, 2 config, 3 insufficient)")
    .option(
      "--format <format>",
      "Report format: terminal|json|html|agent",
      "terminal",
    )
    .option("-q, --quiet", "Suppress terminal report (still writes artifacts)")
    .action(async (opts: {
      local?: boolean;
      skipRemote?: boolean;
      preview?: boolean;
      previewUrl?: string;
      filter?: string;
      ci?: boolean;
      format?: string;
      quiet?: boolean;
    }) => {
      const format = (opts.format ?? "terminal") as ReportFormat;
      const result = await runParitySuite({
        localOnly: Boolean(opts.local || opts.skipRemote),
        skipRemote: Boolean(opts.local || opts.skipRemote),
        usePreview: Boolean(opts.preview || opts.previewUrl),
        previewUrl: opts.previewUrl,
        filter: opts.filter,
        ci: Boolean(opts.ci),
        formats: [format, "json"],
        quiet: Boolean(opts.quiet),
      });
      process.exitCode = result.exitCode;
    });
}
