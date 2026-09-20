import type { Command } from "commander";
import { runVerify } from "../../verify/index.js";
import type { ReportFormat } from "../../reporter/index.js";

export function registerVerifyCommand(program: Command): void {
  const action = async (opts: {
    format?: string;
    vitest?: boolean;
    preview?: boolean;
    previewUrl?: string;
    local?: boolean;
    ci?: boolean;
    filter?: string;
    quiet?: boolean;
  }) => {
    const result = await runVerify({
      format: (opts.format ?? "terminal") as ReportFormat,
      vitest: opts.vitest,
      preview: opts.preview,
      previewUrl: opts.previewUrl,
      localOnly: opts.local,
      ci: opts.ci,
      filter: opts.filter,
      quiet: opts.quiet,
    });
    process.exitCode = result.exitCode;
  };

  program
    .command("verify")
    .alias("v")
    .description(
      "Zero-config high-level verification — runs available checks honestly",
    )
    .option("--format <format>", "terminal|json|agent", "terminal")
    .option("--vitest", "Run detected Vitest suite")
    .option("--preview", "Include preview URL differential when configured")
    .option("--preview-url <url>", "Use existing preview URL")
    .option("--local", "Local-only parity (skip remote/preview)")
    .option("--ci", "CI exit codes")
    .option("--filter <pattern>", "Filter parity corpus tests")
    .option("-q, --quiet", "Suppress stdout report")
    .action(action);
}
