import type { Command } from "commander";
import {
  discoverProject,
  EdgeMirrorDiscoveryError,
  formatDoctorReport,
} from "../../discovery/index.js";
import { discoverZeroConfig } from "../../discovery/zeroconfig.js";
import { detectCloudflareAuth } from "../../adapters/cloudflare/auth.js";
import {
  formatBindingsSupportTable,
  CloudflareBindingAdapter,
} from "../../adapters/cloudflare/index.js";
import { buildCloudflareSupportReport } from "../../adapters/cloudflare/support-report.js";

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Discover Wrangler/workerd/auth/bindings fingerprint")
    .option("-v, --verbose", "Include machine-readable fingerprint JSON")
    .option("--json", "Print fingerprint as JSON only")
    .option("--bindings", "Print EdgeMirror Cloudflare bindings support matrix")
    .option("--support-report", "Print machine-readable Cloudflare support report")
    .action(
      (opts: {
        verbose?: boolean;
        json?: boolean;
        bindings?: boolean;
        supportReport?: boolean;
      }) => {
        if (opts.supportReport) {
          console.log(
            JSON.stringify(buildCloudflareSupportReport(), null, 2),
          );
          return;
        }
        if (opts.bindings) {
          console.log(formatBindingsSupportTable());
          return;
        }
        try {
          const project = discoverProject();
          const auth = detectCloudflareAuth();
          if (opts.json) {
            console.log(
              JSON.stringify(
                {
                  ...project.fingerprint,
                  authDetail: {
                    mode: auth.mode,
                    label: auth.label,
                    accountIdPresent: auth.accountIdPresent,
                    // never include secrets
                  },
                  bindingSummary: new CloudflareBindingAdapter().summarize(
                    project.wranglerConfig,
                  ),
                },
                null,
                2,
              ),
            );
            return;
          }
          console.log(
            formatDoctorReport(project.fingerprint, Boolean(opts.verbose)),
          );

          console.log("");
          console.log("Authentication");
          console.log(`  mode ................... ${auth.mode}`);
          console.log(`  status ................. ${auth.label}`);
          console.log(
            `  account id ............. ${auth.accountIdPresent ? "present" : "not set"}`,
          );
          for (const h of auth.hints) {
            console.log(`  note ................... ${h}`);
          }
          if (!auth.configured) {
            console.log(
              "  remote/preview ......... REMOTE_NOT_CONFIGURED until authenticated",
            );
          }

          const bindingSummary = new CloudflareBindingAdapter().summarize(
            project.wranglerConfig,
          ) as { present: Array<{ id: string; parity: string }> };
          console.log("");
          console.log("Declared bindings (parity capability)");
          if (bindingSummary.present.length === 0) {
            console.log("  (none beyond HTTP fetch handler)");
          } else {
            for (const b of bindingSummary.present) {
              console.log(`  ${b.id.padEnd(22)} parity=${b.parity}`);
            }
          }
          console.log(
            "  Tip: edgemirror doctor --bindings  for full STABLE/BETA/… matrix",
          );

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
          console.log(
            `  preview support ........ ${auth.configured ? "credentials present (versions upload)" : "REMOTE_NOT_CONFIGURED"}`,
          );
        } catch (err) {
          if (err instanceof EdgeMirrorDiscoveryError) {
            console.error(err.message);
            for (const h of err.hints) console.error(`  ${h}`);
            process.exitCode = 2;
            return;
          }
          throw err;
        }
      },
    );
}
