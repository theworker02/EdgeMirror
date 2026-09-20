import type { Command } from "commander";
import { runCompatMatrix } from "../../compat/index.js";

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
    .action(async (opts: { dates?: string; filter?: string }) => {
      const dates = opts.dates
        ? opts.dates.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
      const { exitCode } = await runCompatMatrix({
        dates,
        filter: opts.filter,
      });
      process.exitCode = exitCode;
    });
}
