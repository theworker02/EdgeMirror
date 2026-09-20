import type { Command } from "commander";
import { spawn } from "node:child_process";
import { runVerify } from "../../verify/index.js";
import { discoverProject } from "../../discovery/index.js";

/**
 * `edgemirror deploy` orchestrates verify then wrangler deploy.
 * Never replaces wrangler — always shells out.
 */
export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description(
      "Run edgemirror verify, then wrangler deploy (does not replace wrangler)",
    )
    .option("--skip-verify", "Skip verify step")
    .option("--local-verify", "Verify with local-only parity")
    .option("--ci", "CI verify exit codes")
    .allowUnknownOption(true)
    .action(async (opts: { skipVerify?: boolean; localVerify?: boolean; ci?: boolean }, cmd: Command) => {
      if (!opts.skipVerify) {
        const verify = await runVerify({
          localOnly: Boolean(opts.localVerify),
          ci: Boolean(opts.ci),
        });
        if (verify.exitCode !== 0) {
          console.error(
            `Verify failed (exit ${verify.exitCode}); aborting deploy. Use --skip-verify to override.`,
          );
          process.exitCode = verify.exitCode;
          return;
        }
      }

      const discovered = discoverProject();
      const passthrough = cmd.args ?? [];
      const wranglerArgs = [
        "wrangler",
        "deploy",
        "--config",
        discovered.wranglerConfigPath,
        ...passthrough,
      ];

      const code = await new Promise<number>((resolve) => {
        const child = spawn(
          process.platform === "win32" ? "npx.cmd" : "npx",
          wranglerArgs,
          {
            cwd: discovered.projectRoot,
            stdio: "inherit",
            windowsHide: true,
            shell: process.platform === "win32",
            env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
          },
        );
        child.on("close", (c) => resolve(c ?? 1));
      });
      process.exitCode = code;
    });
}
