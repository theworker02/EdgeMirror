import type { Command } from "commander";
import { runDemo } from "../../demo/index.js";

export function registerDemoCommand(program: Command): void {
  program
    .command("demo")
    .description(
      "Run an isolated DEMO Worker with controlled labeled divergence (never mixes with real corpus)",
    )
    .option("--keep", "Keep the temp DEMO directory for inspection")
    .option("-q, --quiet", "Suppress stdout")
    .action(async (opts: { keep?: boolean; quiet?: boolean }) => {
      const result = await runDemo({
        keep: opts.keep,
        quiet: opts.quiet,
      });
      process.exitCode = result.exitCode;
    });
}
