import type { Command } from "commander";
import pc from "picocolors";

/**
 * Lightweight Cloud billing status for the OSS CLI.
 * Does not cripple local verify — informational + upgrade messaging only.
 */
export function registerCloudCommand(program: Command): void {
  const cloud = program
    .command("cloud")
    .description("EdgeMirror Cloud helpers (billing status; OSS CLI stays fully local)");

  cloud
    .command("billing")
    .description("Show Cloud billing / entitlement status (read-only)")
    .option("--org <orgId>", "Organization id", "org_local")
    .option("--api <url>", "Control-plane base URL", process.env.EDGEMIRROR_API_URL ?? "http://127.0.0.1:8787")
    .option("--json", "Machine-readable output")
    .action(async (opts: { org: string; api: string; json?: boolean }) => {
      const url = `${opts.api.replace(/\/$/, "")}/v1/billing/status?orgId=${encodeURIComponent(opts.org)}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.error(pc.red(`Billing status failed (${res.status}). Is edgemirror-api running?`));
          console.error(pc.dim("OSS alternative: edgemirror verify — no Cloud subscription required."));
          process.exitCode = 1;
          return;
        }
        const body = (await res.json()) as Record<string, unknown>;
        if (opts.json) {
          console.log(JSON.stringify(body, null, 2));
          return;
        }
        console.log(pc.bold("EdgeMirror Cloud billing"));
        console.log(`  mode:     ${String(body.mode)}`);
        console.log(`  org:      ${String(body.orgId)}`);
        console.log(`  plan:     ${String(body.planId)} (effective: ${String(body.effectivePlanId)})`);
        console.log(`  status:   ${String(body.subscriptionStatus)}`);
        const cu = body.cu as { used: number; ceiling: number; period: string } | undefined;
        if (cu) {
          console.log(`  CU:       ${cu.used}/${cu.ceiling} (${cu.period}) — entitlement, not currency`);
        }
        console.log(pc.dim(String(body.ossAlternative ?? "")));
        if (body.mode === "BILLING_NOT_CONFIGURED") {
          console.log(pc.yellow("  Stripe keys not configured — no charges possible."));
        }
      } catch {
        console.error(pc.red(`Could not reach ${url}`));
        console.error(pc.dim("Start apps/api or use the OSS CLI locally: edgemirror verify"));
        process.exitCode = 1;
      }
    });
}
