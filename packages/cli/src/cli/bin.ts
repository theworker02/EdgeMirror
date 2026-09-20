#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { EDGEMIRROR_VERSION } from "../version.js";
import { registerInitCommand } from "./commands/init.js";
import { registerDoctorCommand } from "./commands/doctor.js";
import { registerTestCommand } from "./commands/test.js";
import { registerVerifyCommand } from "./commands/verify.js";
import { registerPreviewCommand } from "./commands/preview.js";
import { registerCompatCommand } from "./commands/compat.js";
import { registerBundleCommand } from "./commands/bundle.js";
import { registerDeployCommand } from "./commands/deploy.js";
import { registerDemoCommand } from "./commands/demo.js";
import { runDefaultAction } from "./onboarding.js";
import { formatError } from "./ux.js";

const program = new Command();

program
  .name("edgemirror")
  .description(
    "Production parity testing for Cloudflare Workers — local vs real platform.",
  )
  .version(EDGEMIRROR_VERSION)
  .option("--auto-verify", "Force safe local verify when a Worker project is detected")
  .addHelpText(
    "after",
    `
${pc.dim("EdgeMirror is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.")}

${pc.bold("Examples")}
  edgemirror                 # interactive onboarding (TTY) or safe local verify
  edgemirror init
  edgemirror init --ci
  edgemirror doctor
  edgemirror verify
  edgemirror v --format agent
  edgemirror demo            # isolated DEMO divergence (never mixes with real corpus)
  edgemirror test --local
  edgemirror preview
  edgemirror compat --dates 2024-11-11,2025-04-01
  edgemirror bundle EM-001

${pc.bold("Status language")}  VERIFIED · DIVERGENT · RUNNING · UNKNOWN · STALE · BLOCKED · FAILED · DEMO
`,
  );

registerInitCommand(program);
registerDoctorCommand(program);
registerTestCommand(program);
registerVerifyCommand(program);
registerPreviewCommand(program);
registerCompatCommand(program);
registerBundleCommand(program);
registerDeployCommand(program);
registerDemoCommand(program);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const known = new Set([
    "init",
    "doctor",
    "test",
    "verify",
    "v",
    "preview",
    "compat",
    "bundle",
    "deploy",
    "demo",
    "help",
  ]);
  const first = argv.find((a) => !a.startsWith("-"));
  const wantsHelp = argv.includes("-h") || argv.includes("--help");
  const wantsVersion = argv.includes("-V") || argv.includes("--version");

  if ((!first || !known.has(first)) && !wantsHelp && !wantsVersion && argv.every((a) => a.startsWith("-") || !known.has(a))) {
    // Bare invocation or only global flags → onboarding / auto-verify
    if (argv.includes("--auto-verify")) {
      process.env.EDGEMIRROR_AUTO_VERIFY = "1";
    }
    if (!first) {
      const result = await runDefaultAction(process.cwd());
      if (result.mode === "help") {
        program.outputHelp();
      }
      process.exitCode = result.exitCode;
      return;
    }
  }

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  const hints =
    err && typeof err === "object" && "hints" in err
      ? (err as { hints: string[] }).hints
      : [];
  console.error(formatError(message, hints));
  process.exitCode = 2;
});
