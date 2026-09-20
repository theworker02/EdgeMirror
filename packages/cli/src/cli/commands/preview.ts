import type { Command } from "commander";
import { discoverProject } from "../../discovery/index.js";
import { ensureArtifactsDir, loadConfig } from "../../config/index.js";
import { PreviewExecutionTarget } from "../../execution/preview.js";
import { LocalExecutionTarget } from "../../execution/local.js";
import { selectTests } from "../../corpus/index.js";
import { buildParityResult, scoreParityResults } from "../../diff/index.js";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { writeTrace, createReceipt, nextFindingId, resetFindingCounter, writeReceipt } from "../../provenance/index.js";
import { formatTerminalReport, type RunReport } from "../../reporter/index.js";
import { EDGEMIRROR_VERSION } from "../../version.js";

export function registerPreviewCommand(program: Command): void {
  program
    .command("preview")
    .description(
      "Local ↔ preview differential testing (REMOTE_NOT_CONFIGURED without credentials)",
    )
    .option("--url <url>", "Existing preview URL (skip upload)")
    .option("--filter <pattern>", "Filter tests")
    .option("--ci", "CI exit codes")
    .action(async (opts: { url?: string; filter?: string; ci?: boolean }) => {
      const discovered = discoverProject();
      const config = loadConfig(discovered.projectRoot);
      const artifacts = ensureArtifactsDir(discovered.projectRoot);
      const runId = `preview-${randomUUID().slice(0, 8)}`;
      const runDir = join(artifacts, "runs", runId);
      mkdirSync(join(runDir, "traces"), { recursive: true });
      mkdirSync(join(runDir, "receipts"), { recursive: true });
      resetFindingCounter(0);

      const ctx = {
        projectRoot: discovered.projectRoot,
        wranglerConfigPath: discovered.wranglerConfigPath,
        configurationFingerprint: discovered.configurationFingerprint,
        ownershipDir: join(artifacts, "ownership"),
      };

      const local = new LocalExecutionTarget(ctx);
      const preview = new PreviewExecutionTarget(ctx, { existingUrl: opts.url });

      await local.prepare();
      await preview.prepare();
      const prep = preview.getPrepareStatus();

      const tests = selectTests({
        includeBuiltin: config.corpus.includeBuiltin,
        filter: opts.filter,
      });

      const results = [];
      try {
        for (const test of tests) {
          const localTrace = await local.execute(test);
          const remoteTrace = await preview.execute(test);
          writeTrace(join(runDir, "traces"), localTrace);
          writeTrace(join(runDir, "traces"), remoteTrace);
          const findingId = nextFindingId("EM");
          const result = buildParityResult({
            testId: test.id,
            local: localTrace,
            remote: remoteTrace,
            expectedBehavior: test.expectedBehavior,
            findingId,
          });
          const receipt = createReceipt({
            findingId,
            result,
            localTrace,
            remoteTrace,
          });
          writeReceipt(join(runDir, "receipts"), receipt);
          results.push(result);
        }
      } finally {
        await local.cleanup();
        await preview.cleanup();
      }

      const report: RunReport = {
        schemaVersion: "1.0",
        edgemirrorVersion: EDGEMIRROR_VERSION,
        runId,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        projectRoot: discovered.projectRoot,
        results,
        score: scoreParityResults(results),
        remoteStatus: prep.configured ? "configured" : "REMOTE_NOT_CONFIGURED",
        remoteReason: prep.reason,
        checks: [
          {
            id: "preview",
            name: "Preview URL",
            status: prep.configured ? "passed" : "unavailable",
            reason: prep.configured ? undefined : "REMOTE_NOT_CONFIGURED",
            detail: prep.previewUrl,
          },
        ],
      };

      writeFileSync(join(runDir, "summary.json"), JSON.stringify(report, null, 2));
      console.log(formatTerminalReport(report));

      if (!prep.configured && opts.ci) {
        process.exitCode = 3;
      } else if (results.some((r) => r.classification === "RUNTIME_DIVERGENCE")) {
        process.exitCode = 1;
      } else {
        process.exitCode = 0;
      }
    });
}
