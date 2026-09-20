import type { Command } from "commander";
import { runCompatMatrix } from "../../compat/index.js";
import type { GovernorMode } from "../../supercharger/types.js";

export function registerCompatCommand(program: Command): void {
  program
    .command("compat")
    .description(
      "Compatibility-date matrix (local real executions; remote not fabricated)",
    )
    .option(
      "--dates <list>",
      "Comma-separated compatibility dates (defaults to wrangler date)",
    )
    .option("--filter <pattern>", "Corpus filter", "http-get-root")
    .option(
      "--supercharge",
      "Prune impossible cells and schedule independent dates",
    )
    .option("--mode <mode>", "ECO|BALANCED|FAST|MAX", "BALANCED")
    .action(
      async (opts: {
        dates?: string;
        filter?: string;
        supercharge?: boolean;
        mode?: string;
      }) => {
        const dates = opts.dates
          ? opts.dates.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined;
        const { exitCode } = await runCompatMatrix({
          dates,
          filter: opts.filter,
          supercharge: opts.supercharge,
          mode: (opts.mode ?? "BALANCED").toUpperCase() as GovernorMode,
        });
        process.exitCode = exitCode;
      },
    );
}
