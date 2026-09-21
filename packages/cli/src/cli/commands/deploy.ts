import type { Command } from "commander";
import { runVerify } from "../../verify/index.js";
import { discoverProject } from "../../discovery/index.js";
import { spawnWranglerSafe } from "../../security/spawn.js";

const FORCE_BANNER = `
╔══════════════════════════════════════════════════════════════════╗
║  WARNING: Deploying WITHOUT EdgeMirror verify evidence           ║
║  You are skipping the local↔Workers parity gate.                 ║
║  Prefer: edgemirror deploy   (verify, then wrangler deploy)      ║
╚══════════════════════════════════════════════════════════════════╝
`.trim();

/**
 * `edgemirror deploy` orchestrates verify then wrangler deploy.
 * Never replaces wrangler — always shells out via argv-safe spawn.
 * Failed verify aborts deploy unless `--force` (loud) is passed.
 */
export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description(
      "Run edgemirror verify, then wrangler deploy (does not replace wrangler)",
    )
    .option(
      "--force",
      "Deploy even if verify failed or was skipped (prints a loud warning)",
    )
    .option(
      "--skip-verify",
      "Skip verify step (requires --force; not recommended)",
    )
    .option("--local-verify", "Verify with local-only parity")
    .option("--ci", "CI verify exit codes")
    .allowUnknownOption(true)
    .action(
      async (
        opts: {
          force?: boolean;
          skipVerify?: boolean;
          localVerify?: boolean;
          ci?: boolean;
        },
        cmd: Command,
      ) => {
        const force = Boolean(opts.force);
        const skipVerify = Boolean(opts.skipVerify);

        if (skipVerify && !force) {
          console.error(
            "Refusing to skip verify without --force.\n" +
              "  Deploy confidence path: edgemirror deploy\n" +
              "  Override (loud):         edgemirror deploy --skip-verify --force",
          );
          process.exitCode = 2;
          return;
        }

        if (!skipVerify) {
          const verify = await runVerify({
            localOnly: Boolean(opts.localVerify),
            ci: Boolean(opts.ci),
          });
          if (verify.exitCode !== 0) {
            if (!force) {
              console.error(
                `Verify failed (exit ${verify.exitCode}); aborting deploy.\n` +
                  "  Fix the divergence or insufficient evidence, then retry.\n" +
                  "  Override (loud): edgemirror deploy --force",
              );
              process.exitCode = verify.exitCode;
              return;
            }
            console.error(FORCE_BANNER);
            console.error(
              `Proceeding after failed verify (exit ${verify.exitCode}) because --force was set.`,
            );
          }
        } else {
          console.error(FORCE_BANNER);
          console.error("Proceeding with --skip-verify --force.");
        }

        const discovered = discoverProject();
        const passthrough = (cmd.args ?? []).filter(
          (a) => typeof a === "string" && !a.includes("\0"),
        );
        const code = await new Promise<number>((resolve) => {
          const { child } = spawnWranglerSafe(
            discovered.projectRoot,
            ["deploy", "--config", discovered.wranglerConfigPath, ...passthrough],
            { stdio: "inherit" },
          );
          child.on("close", (c) => resolve(c ?? 1));
          child.on("error", () => resolve(1));
        });
        process.exitCode = code;
      },
    );
}
