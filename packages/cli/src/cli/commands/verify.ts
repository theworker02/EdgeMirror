import type { Command } from "commander";
import { runVerify } from "../../verify/index.js";
import type { ReportFormat } from "../../reporter/index.js";
import type { GovernorMode } from "../../supercharger/types.js";
import { parseSchedulerKind } from "../../supercharger/types.js";

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
    supercharge?: boolean | string;
    fast?: boolean;
    full?: boolean;
    nightly?: boolean;
    mode?: string;
    cu?: string;
    scheduler?: string;
  }) => {
    let selection: "full" | "fast" | "incremental" | "nightly" | undefined;
    if (opts.nightly) selection = "nightly";
    else if (opts.full) selection = "full";
    else if (opts.fast) selection = "fast";
    else if (opts.supercharge) selection = "incremental";

    const cuFromFlag =
      typeof opts.supercharge === "string" && /^\d+$/.test(opts.supercharge)
        ? Number(opts.supercharge)
        : opts.cu
          ? Number(opts.cu)
          : undefined;

    const scheduler = opts.scheduler
      ? parseSchedulerKind(opts.scheduler)
      : undefined;

    const result = await runVerify({
      format: (opts.format ?? "terminal") as ReportFormat,
      vitest: opts.vitest,
      preview: opts.preview,
      previewUrl: opts.previewUrl,
      localOnly: opts.local,
      ci: opts.ci,
      filter: opts.filter,
      quiet: opts.quiet,
      supercharge: opts.supercharge
        ? {
            enabled: true,
            mode: (opts.mode ?? "BALANCED").toUpperCase() as GovernorMode,
            selection: selection ?? "incremental",
            timeToConfidence: true,
            cache: true,
            maxCu: Number.isFinite(cuFromFlag) ? cuFromFlag : undefined,
            scheduler: scheduler ?? "classic",
          }
        : selection
          ? {
              enabled: false,
              selection,
            }
          : undefined,
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
    .option(
      "--supercharge [cu]",
      "Optional Supercharger; optional CU budget (e.g. --supercharge 50000)",
    )
    .option("--cu <n>", "CU budget when Supercharger is enabled")
    .option("--fast", "Time-to-confidence subset (honest reduced selection)")
    .option("--full", "Full corpus selection")
    .option("--nightly", "Nightly selection (currently full; labeled honestly)")
    .option("--mode <mode>", "Supercharger governor ECO|BALANCED|FAST|MAX", "BALANCED")
    .option(
      "--scheduler <kind>",
      "Supercharger scheduler: classic|double-trouble",
      "classic",
    )
    .option("-q, --quiet", "Suppress stdout report")
    .action(action);
}
