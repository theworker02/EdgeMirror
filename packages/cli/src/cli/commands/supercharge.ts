import type { Command } from "commander";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { selectTests } from "../../corpus/index.js";
import { loadConfig, ensureArtifactsDir } from "../../config/index.js";
import { discoverProject } from "../../discovery/index.js";
import {
  buildSuperchargePlan,
  formatPlan,
  captureResources,
  formatResourceDoctor,
  runMicrobench,
  evaluatePerfGates,
  parallelMinimize,
  listGovernors,
  type GovernorMode,
} from "../../supercharger/index.js";

export function registerSuperchargeCommand(program: Command): void {
  const cmd = program
    .command("supercharge")
    .description(
      "Optional Supercharger — DAG scheduler, CU budgets, governors (not required for verify)",
    );

  cmd
    .command("doctor")
    .description("Resource discovery for adaptive concurrency")
    .option("--mode <mode>", "ECO|BALANCED|FAST|MAX", "BALANCED")
    .action((opts: { mode?: string }) => {
      const mode = (opts.mode ?? "BALANCED").toUpperCase() as GovernorMode;
      const snap = captureResources({ mode });
      console.log(formatResourceDoctor(snap));
      console.log("");
      console.log("Governors:");
      for (const g of listGovernors()) {
        console.log(
          `  ${g.mode.padEnd(9)} conc≤${g.maxConcurrency}  cu≤${g.maxCu}  — ${g.description}`,
        );
      }
    });

  cmd
    .command("plan")
    .description("Estimate Supercharger job DAG (estimates only)")
    .option("--mode <mode>", "ECO|BALANCED|FAST|MAX", "BALANCED")
    .option("--remote", "Include remote prepare/execute jobs in the plan")
    .option("--filter <pattern>", "Filter corpus tests")
    .option("--json", "Print JSON plan")
    .action((opts: { mode?: string; remote?: boolean; filter?: string; json?: boolean }) => {
      const cwd = process.cwd();
      let testIds: string[];
      try {
        const discovered = discoverProject(cwd);
        const config = loadConfig(discovered.projectRoot);
        const tests = selectTests({
          includeBuiltin: config.corpus.includeBuiltin,
          paths: config.corpus.paths.map((p) => join(discovered.projectRoot, p)),
          filter: opts.filter,
        });
        testIds = tests.map((t) => t.id);
      } catch {
        const tests = selectTests({
          includeBuiltin: true,
          filter: opts.filter,
        });
        testIds = tests.map((t) => t.id);
        if (!opts.json) {
          console.log(
            "(No Wrangler project in cwd — planning against builtin corpus only.)",
          );
        }
      }
      const plan = buildSuperchargePlan({
        testIds,
        includeRemote: Boolean(opts.remote),
        mode: (opts.mode ?? "BALANCED").toUpperCase() as GovernorMode,
      });
      if (opts.json) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        console.log(formatPlan(plan));
      }
    });

  cmd
    .command("bench")
    .description("Run reproducible synthetic microbench (measured only)")
    .option("--jobs <n>", "Job count", "24")
    .option("--sleep-ms <n>", "Per-job sleep", "15")
    .option("--mode <mode>", "ECO|BALANCED|FAST|MAX", "FAST")
    .option("--json", "Print JSON")
    .action(async (opts: { jobs?: string; sleepMs?: string; mode?: string; json?: boolean }) => {
      const bench = await runMicrobench({
        jobs: Number(opts.jobs ?? 24),
        sleepMs: Number(opts.sleepMs ?? 15),
        mode: (opts.mode ?? "FAST").toUpperCase() as GovernorMode,
      });
      const gates = evaluatePerfGates(bench);
      const cwd = process.cwd();
      let outDir: string;
      try {
        const discovered = discoverProject(cwd);
        outDir = join(ensureArtifactsDir(discovered.projectRoot), "benchmarks");
      } catch {
        outDir = join(cwd, "benchmarks");
      }
      mkdirSync(outDir, { recursive: true });
      const outPath = join(outDir, `microbench-${Date.now()}.json`);
      writeFileSync(
        outPath,
        JSON.stringify({ bench, gates }, null, 2),
        "utf8",
      );
      if (opts.json) {
        console.log(JSON.stringify({ bench, gates, outPath }, null, 2));
      } else {
        console.log("Supercharger microbench (measured)");
        console.log(bench.disclaimer);
        console.log(
          `Standard sequential:   ${bench.standard.wallMs} ms  (${bench.standard.jobsPerSec} jobs/s)`,
        );
        console.log(
          `Supercharger schedule: ${bench.supercharger.wallMs} ms  (${bench.supercharger.jobsPerSec} jobs/s)  conc=${bench.supercharger.concurrency}  cu=${bench.supercharger.cuUsed}`,
        );
        console.log(
          `Measured wall ratio:   ${bench.ratio.wallSpeedupMeasured}× (standard/supercharger)`,
        );
        console.log(`Gates: ${gates.passed ? "PASS" : "FAIL"}`);
        for (const g of gates.results) {
          console.log(`  [${g.pass ? "ok" : "FAIL"}] ${g.id} — ${g.detail}`);
        }
        console.log(`Wrote ${outPath}`);
      }
      process.exitCode = gates.passed ? 0 : 1;
    });

  cmd
    .command("minimize-demo")
    .description("Demo parallel minimizer on a synthetic failing set")
    .action(async () => {
      const candidates = [1, 2, 3, 4, 5, 6, 7, 8];
      const failing = new Set([3, 7]);
      const result = await parallelMinimize({
        candidates,
        keyOf: (n) => String(n),
        stillFails: (subset) => subset.some((x) => failing.has(x)),
        mode: "FAST",
      });
      console.log(JSON.stringify(result, null, 2));
      console.log(result.note);
    });

  // Default: show help-ish doctor summary
  cmd.action(() => {
    console.log("EdgeMirror Supercharger (optional)");
    console.log("  edgemirror supercharge doctor");
    console.log("  edgemirror supercharge plan");
    console.log("  edgemirror supercharge bench");
    console.log("  edgemirror verify --supercharge");
    console.log("  edgemirror verify --fast");
    console.log("");
    console.log("CU = resource accounting only — not cryptocurrency.");
    console.log("OSS verify works without Supercharger.");
  });
}
