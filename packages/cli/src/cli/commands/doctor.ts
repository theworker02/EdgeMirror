import type { Command } from "commander";
import {
  discoverProject,
  EdgeMirrorDiscoveryError,
  formatDoctorReport,
} from "../../discovery/index.js";
import { discoverZeroConfig } from "../../discovery/zeroconfig.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Discover Wrangler project and environment fingerprint")
    .option("-v, --verbose", "Include machine-readable fingerprint JSON")
    .option("--json", "Print fingerprint as JSON only")
    .action((opts: { verbose?: boolean; json?: boolean }) => {
      try {
        const project = discoverProject();
        if (opts.json) {
          console.log(JSON.stringify(project.fingerprint, null, 2));
          return;
        }
        console.log(formatDoctorReport(project.fingerprint, Boolean(opts.verbose)));

        const zc = discoverZeroConfig(project.projectRoot);
        console.log("");
        console.log("Zero-config extras");
        console.log(
          `  Vitest ................. ${zc.vitest.detected ? (zc.vitest.cloudflarePool ? "detected (CF pool)" : "detected") : "not found"}`,
        );
        console.log(
          `  Vite ................... ${zc.vite.detected ? "detected" : "not found"}`,
        );
        console.log(
          `  TypeScript ............. ${zc.typescript.detected ? "detected" : "not found"}`,
        );
        console.log(`  package manager ........ ${zc.packageManager}`);
      } catch (err) {
        if (err instanceof EdgeMirrorDiscoveryError) {
          console.error(err.message);
          for (const h of err.hints) console.error(`  ${h}`);
          process.exitCode = 2;
          return;
        }
        throw err;
      }
    });
}
