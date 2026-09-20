/**
 * Bare `edgemirror` (no args) — interactive onboarding or safe local auto-verify.
 * Every menu item maps to a scriptable CLI command.
 */

import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { discoverZeroConfig } from "../discovery/zeroconfig.js";
import { EDGEMIRROR_VERSION } from "../version.js";
import { runVerify } from "../verify/index.js";
import { formatBanner, formatSection, formatStatusBadge } from "./ux.js";

export interface OnboardingMenuItem {
  key: string;
  label: string;
  command: string;
  /** Safe to auto-run without credentials */
  safeLocal: boolean;
}

export const ONBOARDING_MENU: OnboardingMenuItem[] = [
  {
    key: "1",
    label: "60-second local verify (safe, no Cloudflare credentials)",
    command: "edgemirror verify --local",
    safeLocal: true,
  },
  {
    key: "2",
    label: "Doctor — fingerprint this Worker project",
    command: "edgemirror doctor",
    safeLocal: true,
  },
  {
    key: "3",
    label: "Initialize edgemirror.yaml + .edgemirror/",
    command: "edgemirror init",
    safeLocal: true,
  },
  {
    key: "4",
    label: "Scaffold CI (GitHub / Workers Builds / GitLab)",
    command: "edgemirror init --ci",
    safeLocal: true,
  },
  {
    key: "5",
    label: "DEMO — isolated temp Worker with labeled DEMO divergence",
    command: "edgemirror demo",
    safeLocal: true,
  },
  {
    key: "6",
    label: "Full verify (needs Cloudflare credentials for remote)",
    command: "edgemirror verify",
    safeLocal: false,
  },
  {
    key: "7",
    label: "Show help",
    command: "edgemirror --help",
    safeLocal: true,
  },
  {
    key: "q",
    label: "Quit",
    command: "(exit)",
    safeLocal: true,
  },
];

function isInteractive(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

function printBanner(discovery: ReturnType<typeof discoverZeroConfig>): void {
  process.stdout.write(formatBanner());
  if (discovery.hasWrangler) {
    const name =
      discovery.worker?.fingerprint.workerName ??
      discovery.wranglerConfigPath ??
      "Worker project";
    console.log(
      `${formatStatusBadge("VERIFIED")}  Detected Cloudflare Worker project: ${name}`,
    );
    if (discovery.createCloudflare?.detected) {
      console.log(
        pc.dim(
          `  create-cloudflare / C3 signals: ${discovery.createCloudflare.signals.join(", ")}`,
        ),
      );
    }
  } else {
    console.log(
      `${formatStatusBadge("BLOCKED")}  No wrangler.json(c)/toml found here. Init a Worker project, or run from one.`,
    );
  }
  console.log("");
}

function printMenu(): void {
  console.log(formatSection("What would you like to do?"));
  console.log("");
  for (const item of ONBOARDING_MENU) {
    const suffix = item.safeLocal ? "" : pc.dim(" (may need CF credentials)");
    console.log(`  ${pc.cyan(item.key)}) ${item.label}${suffix}`);
    console.log(pc.dim(`     → ${item.command}`));
  }
  console.log("");
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    return await new Promise<string>((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  } finally {
    rl.close();
  }
}

/**
 * Auto-run safe local 60-second-style verification when a CF project is detected
 * and the environment is non-interactive (CI / piped), or when EDGEMIRROR_AUTO_VERIFY=1.
 */
export async function maybeAutoLocalVerify(
  cwd = process.cwd(),
): Promise<{ ran: boolean; exitCode?: number }> {
  const discovery = discoverZeroConfig(cwd);
  const force =
    process.env.EDGEMIRROR_AUTO_VERIFY === "1" ||
    process.env.EDGEMIRROR_AUTO_VERIFY === "true";
  const nonInteractive = !isInteractive();
  if (!discovery.hasWrangler) return { ran: false };
  if (!force && !nonInteractive) return { ran: false };

  console.log(
    pc.dim(
      "Cloudflare Worker detected — running safe local verify (`edgemirror verify --local`).",
    ),
  );
  console.log(
    pc.dim(
      "Tip: interactive menu with `edgemirror` in a TTY; disable auto with EDGEMIRROR_AUTO_VERIFY=0.",
    ),
  );
  const result = await runVerify({
    cwd: discovery.projectRoot,
    localOnly: true,
    quiet: false,
    format: "terminal",
  });
  return { ran: true, exitCode: result.exitCode };
}

export type DefaultActionResult =
  | { mode: "auto-verify"; exitCode: number }
  | { mode: "menu"; exitCode: number }
  | { mode: "help"; exitCode: number };

/**
 * Entry for bare `edgemirror` with no subcommand.
 */
export async function runDefaultAction(
  cwd = process.cwd(),
): Promise<DefaultActionResult> {
  const discovery = discoverZeroConfig(cwd);
  const autoDisabled =
    process.env.EDGEMIRROR_AUTO_VERIFY === "0" ||
    process.env.EDGEMIRROR_AUTO_VERIFY === "false";

  // Non-interactive + Worker project → safe local verify (unless disabled)
  if (!isInteractive() && discovery.hasWrangler && !autoDisabled) {
    const auto = await maybeAutoLocalVerify(cwd);
    if (auto.ran) {
      return { mode: "auto-verify", exitCode: auto.exitCode ?? 0 };
    }
  }

  // Explicit force auto even in TTY
  if (
    discovery.hasWrangler &&
    (process.env.EDGEMIRROR_AUTO_VERIFY === "1" ||
      process.env.EDGEMIRROR_AUTO_VERIFY === "true")
  ) {
    const auto = await maybeAutoLocalVerify(cwd);
    if (auto.ran) {
      return { mode: "auto-verify", exitCode: auto.exitCode ?? 0 };
    }
  }

  if (!isInteractive()) {
    console.log(
      `EdgeMirror ${EDGEMIRROR_VERSION} — run with a subcommand or in a TTY for onboarding.`,
    );
    console.log("Examples: edgemirror verify --local | edgemirror doctor | edgemirror --help");
    return { mode: "help", exitCode: 0 };
  }

  printBanner(discovery);
  printMenu();

  const answer = await prompt(pc.cyan("Choose [1-7 / q]: "));
  const item =
    ONBOARDING_MENU.find((m) => m.key === answer) ??
    ONBOARDING_MENU.find((m) => m.key === answer.toLowerCase());

  if (!item || item.key === "q") {
    console.log(pc.dim("Bye."));
    return { mode: "menu", exitCode: 0 };
  }

  console.log("");
  console.log(pc.dim(`Running: ${item.command}`));
  console.log("");

  // Dispatch without re-spawning — keep process in-process for reliability.
  const { spawn } = await import("node:child_process");
  const bin = process.argv[1];
  const parts = item.command.replace(/^edgemirror\s*/, "").split(/\s+/).filter(Boolean);

  if (parts[0] === "--help" || parts.length === 0) {
    return { mode: "help", exitCode: 0 };
  }

  // Special-case: verify --local and verify run in-process for speed
  if (parts[0] === "verify" || parts[0] === "v") {
    const local = parts.includes("--local");
    const result = await runVerify({
      cwd: discovery.projectRoot,
      localOnly: local,
      quiet: false,
      format: "terminal",
    });
    return { mode: "menu", exitCode: result.exitCode };
  }

  if (parts[0] === "demo") {
    const { runDemo } = await import("../demo/index.js"); // src/demo
    const result = await runDemo({ quiet: false });
    return { mode: "menu", exitCode: result.exitCode };
  }

  // Re-invoke CLI for remaining commands (doctor, init, init --ci, etc.)
  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [bin, ...parts], {
      cwd,
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
    });
    child.on("close", (c) => resolve(c ?? 1));
  });
  return { mode: "menu", exitCode: code };
}
