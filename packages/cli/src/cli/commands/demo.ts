import type { Command } from "commander";
import { runDemo } from "../../demo/index.js";
import { runPitchDemo } from "../../demo/pitch.js";
import { resetDemoResources } from "../../cleanup/reset.js";

export function registerDemoCommand(program: Command): void {
  const demo = program
    .command("demo")
    .description(
      "Isolated DEMO / pitch-demo Workers (never mixes with real corpus)",
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

  demo
    .command("reset")
    .description(
      "Delete Cloudflare resources EdgeMirror can prove it owns (ownership markers)",
    )
    .option("-q, --quiet", "Suppress stdout")
    .action(async (opts: { quiet?: boolean }) => {
      const result = await resetDemoResources({ quiet: opts.quiet });
      process.exitCode = result.failed.length > 0 ? 1 : 0;
    });

  demo
    .command("cloudflare")
    .description(
      "Live Cloudflare pitch demo: real local workerd + optional preview (<5 min)",
    )
    .option("--keep", "Keep the temp DEMO directory")
    .option("-q, --quiet", "Suppress stdout")
    .option("--preview-url <url>", "Use an existing preview URL")
    .option(
      "--synthesize-demo-remote",
      "Offline rehearsal: synthesize DEMO remote when credentials absent",
    )
    .action(
      async (opts: {
        keep?: boolean;
        quiet?: boolean;
        previewUrl?: string;
        synthesizeDemoRemote?: boolean;
      }) => {
        const result = await runPitchDemo({
          keep: opts.keep,
          quiet: opts.quiet,
          previewUrl: opts.previewUrl,
          synthesizeDemoRemote: opts.synthesizeDemoRemote,
        });
        process.exitCode = result.exitCode;
      },
    );
}

export function registerPitchDemoCommand(program: Command): void {
  program
    .command("pitch-demo")
    .description(
      "Alias for `edgemirror demo cloudflare` — live meeting demo (<5 min)",
    )
    .option("--keep", "Keep the temp directory")
    .option("-q, --quiet", "Suppress stdout")
    .option("--preview-url <url>", "Use an existing preview URL")
    .option(
      "--synthesize-demo-remote",
      "Offline rehearsal: synthesize DEMO remote when credentials absent",
    )
    .action(
      async (opts: {
        keep?: boolean;
        quiet?: boolean;
        previewUrl?: string;
        synthesizeDemoRemote?: boolean;
      }) => {
        const result = await runPitchDemo({
          keep: opts.keep,
          quiet: opts.quiet,
          previewUrl: opts.previewUrl,
          synthesizeDemoRemote: opts.synthesizeDemoRemote,
        });
        process.exitCode = result.exitCode;
      },
    );
}
