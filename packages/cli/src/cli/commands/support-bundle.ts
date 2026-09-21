import type { Command } from "commander";
import {
  discoverProject,
  EdgeMirrorDiscoveryError,
} from "../../discovery/index.js";
import { detectCloudflareAuth } from "../../adapters/cloudflare/auth.js";
import { CloudflareBindingAdapter } from "../../adapters/cloudflare/index.js";
import { resolveProjectRoot } from "../../config/index.js";
import { createSupportEscalationBundle } from "../../support/escalation-bundle.js";

/**
 * Export a Cloudflare support-escalation packet: EM receipts + doctor
 * support-report + bindings matrix + compat artifacts.
 */
export function registerSupportBundleCommand(program: Command): void {
  program
    .command("support-bundle")
    .alias("escalate")
    .description(
      "Export EM receipts + doctor report + compat matrix for a Cloudflare support ticket",
    )
    .action(() => {
      const root = resolveProjectRoot();
      let doctorFingerprint: unknown;
      try {
        const project = discoverProject(root);
        const auth = detectCloudflareAuth();
        doctorFingerprint = {
          ...project.fingerprint,
          authDetail: {
            mode: auth.mode,
            label: auth.label,
            accountIdPresent: auth.accountIdPresent,
          },
          bindingSummary: new CloudflareBindingAdapter().summarize(
            project.wranglerConfig,
          ),
        };
      } catch (err) {
        if (err instanceof EdgeMirrorDiscoveryError) {
          doctorFingerprint = {
            discoveryError: err.message,
            hints: err.hints,
          };
        } else {
          throw err;
        }
      }

      const { bundleDir, manifest } = createSupportEscalationBundle({
        projectRoot: root,
        doctorFingerprint,
      });

      console.log(`Cloudflare support escalation bundle: ${bundleDir}`);
      console.log(`Findings: ${manifest.findingIds.join(", ") || "(none)"}`);
      console.log(`Files: ${manifest.files.length}`);
      console.log(`Auth: ${manifest.authMode} (remoteConfigured=${manifest.remoteConfigured})`);
      console.log("");
      console.log("Attach this directory (or zip it) to your Cloudflare ticket.");
      console.log("See CLOUDFLARE_TICKET.md inside the bundle for a summary template.");
    });
}
