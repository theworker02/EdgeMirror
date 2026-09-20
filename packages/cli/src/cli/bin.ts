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

const program = new Command();

program
  .name("edgemirror")
  .description(
    "Production parity testing for Cloudflare Workers — local vs real platform.",
  )
  .version(EDGEMIRROR_VERSION)
  .addHelpText(
    "after",
    `
${pc.dim("EdgeMirror is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Cloudflare, Inc.")}

Examples:
  edgemirror init
  edgemirror doctor
  edgemirror verify
  edgemirror v --format agent
  edgemirror test --local
  edgemirror preview
  edgemirror compat --dates 2024-11-11,2025-04-01
  edgemirror bundle EM-001
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

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(pc.red(`Error: ${message}`));
  if (err && typeof err === "object" && "hints" in err) {
    for (const hint of (err as { hints: string[] }).hints) {
      console.error(pc.dim(`  ${hint}`));
    }
  }
  process.exitCode = 2;
});
