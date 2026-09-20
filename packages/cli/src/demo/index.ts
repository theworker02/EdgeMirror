/**
 * `edgemirror demo` — isolated temp Worker with controlled DEMO divergence.
 * DEMO findings never enter the caller's real project corpus / .edgemirror.
 */

import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import pc from "picocolors";
import {
  createFingerprint,
  createTrace,
  emptyBindingSummary,
  emptyObservations,
  captured,
} from "../trace/factory.js";
import { buildParityResult, scoreParityResults } from "../diff/index.js";
import { createReceipt, writeReceipt, writeTrace } from "../provenance/index.js";
import { formatTerminalReport, writeReports } from "../reporter/index.js";
import type { RunReport } from "../reporter/index.js";
import { EDGEMIRROR_VERSION } from "../version.js";

export const DEMO_MARKER = "DEMO";
export const DEMO_FINDING_PREFIX = "EM-DEMO-";

export interface DemoOptions {
  quiet?: boolean;
  /** Keep temp dir for inspection (default: delete) */
  keep?: boolean;
}

export interface DemoResult {
  exitCode: number;
  tempDir: string;
  findingId: string;
  report: RunReport;
  demo: true;
}

function writeDemoWorker(root: string): void {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "wrangler.jsonc"),
    `{
  "name": "edgemirror-demo-isolated",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01"
}
`,
    "utf8",
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "edgemirror-demo-isolated",
        private: true,
        type: "module",
      },
      null,
      2,
    ),
    "utf8",
  );
  writeFileSync(
    join(root, "src", "index.ts"),
    `export default {
  async fetch(): Promise<Response> {
    return new Response("demo-local-ok", { status: 200 });
  },
};
`,
    "utf8",
  );
  writeFileSync(
    join(root, "README.DEMO.md"),
    `# EdgeMirror DEMO Worker

This directory is an **isolated DEMO** created by \`edgemirror demo\`.

- Findings are labeled **DEMO** / \`${DEMO_FINDING_PREFIX}*\`
- They must NEVER be mixed into a real project's evidence corpus
- The divergence below is intentional and controlled for illustration

Delete this folder when finished (EdgeMirror removes it unless \`--keep\`).
`,
    "utf8",
  );
}

/**
 * Synthesize a controlled local↔remote DEMO divergence without Cloudflare credentials.
 * Uses fabricated remote observations marked DEMO — not real platform results.
 */
export async function runDemo(options: DemoOptions = {}): Promise<DemoResult> {
  const tempDir = mkdtempSync(join(tmpdir(), "edgemirror-demo-"));
  writeDemoWorker(tempDir);

  const artifacts = join(tempDir, ".edgemirror");
  const runId = `demo-${randomUUID().slice(0, 8)}`;
  const runDir = join(artifacts, "runs", runId);
  mkdirSync(join(runDir, "traces"), { recursive: true });
  mkdirSync(join(runDir, "receipts"), { recursive: true });
  mkdirSync(join(runDir, "reports"), { recursive: true });

  const findingId = `${DEMO_FINDING_PREFIX}001`;
  const fp = createFingerprint({
    projectRoot: tempDir,
    workerName: "edgemirror-demo-isolated",
    entryPoint: "src/index.ts",
    compatibilityDate: "2025-04-01",
    compatibilityFlags: [],
    bindings: emptyBindingSummary(),
  });

  const localObs = emptyObservations();
  localObs.http.status = captured(200);
  localObs.http.body = captured("demo-local-ok");
  localObs.http.headers = captured({ "content-type": "text/plain" });
  localObs.http.bodyEncoding = captured("utf8");
  localObs.notes.push("DEMO: local observation from isolated temp Worker");

  const remoteObs = emptyObservations();
  remoteObs.http.status = captured(200);
  remoteObs.http.body = captured("demo-remote-different");
  remoteObs.http.headers = captured({ "content-type": "text/plain" });
  remoteObs.http.bodyEncoding = captured("utf8");
  remoteObs.notes.push(
    "DEMO: synthesized remote — NOT a live Cloudflare response",
    "DEMO findings must never enter a real project corpus",
  );

  const local = createTrace({
    testId: "demo-http-get-root",
    target: "local",
    status: "ok",
    configurationFingerprint: fp,
    observations: localObs,
  });
  const remote = createTrace({
    testId: "demo-http-get-root",
    target: "remote",
    status: "ok",
    statusReason:
      "DEMO synthesized remote (not live Cloudflare) — for illustration only",
    configurationFingerprint: fp,
    observations: remoteObs,
  });

  const localPath = writeTrace(join(runDir, "traces"), local);
  const remotePath = writeTrace(join(runDir, "traces"), remote);

  const result = buildParityResult({
    testId: "demo-http-get-root",
    local,
    remote,
    findingId,
  });

  const receipt = createReceipt({
    findingId,
    result,
    localTrace: local,
    remoteTrace: remote,
    artifactPaths: [localPath, remotePath],
    notes: [
      "DEMO: intentional controlled divergence — do not treat as production evidence",
      "DEMO findings must never enter a real project corpus",
      `Isolated temp dir: ${tempDir}`,
    ],
  });
  writeReceipt(join(runDir, "receipts"), receipt);

  const report: RunReport = {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    projectRoot: tempDir,
    results: [result],
    score: scoreParityResults([result]),
    remoteStatus: "configured",
    remoteReason:
      "DEMO synthesized remote (not live Cloudflare) — for illustration only",
    demo: true,
    checks: [
      {
        id: "demo",
        name: "DEMO isolated divergence",
        status: "failed",
        reason:
          "Intentional DEMO body mismatch (local vs synthesized remote)",
        detail: findingId,
      },
    ],
  };

  writeReports(join(runDir, "reports"), report, ["terminal", "json"]);
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(runDir, "DEMO.md"),
    `# DEMO run ${runId}

This evidence is **DEMO-only**.

- Finding: \`${findingId}\`
- Temp project: \`${tempDir}\`
- Never copy these receipts into a real project's \`.edgemirror/\`
`,
    "utf8",
  );

  if (!options.quiet) {
    console.log("");
    console.log(pc.bold(pc.magenta("EdgeMirror DEMO")));
    console.log(
      pc.magenta(
        "Isolated temp Worker — findings labeled DEMO — never mixed with real corpus.",
      ),
    );
    console.log(pc.dim(`Temp dir: ${tempDir}`));
    console.log(pc.dim(`Finding:  ${findingId}`));
    console.log("");
    console.log(formatTerminalReport(report));
    console.log("");
    console.log(
      pc.magenta(
        "DEMO complete. Intentional controlled divergence for illustration only.",
      ),
    );
    if (!options.keep) {
      console.log(pc.dim("Cleaning up temp DEMO directory…"));
    } else {
      console.log(pc.dim(`Kept (--keep): ${tempDir}`));
    }
  }

  const keptPath = tempDir;
  if (!options.keep) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  return {
    exitCode: 0,
    tempDir: options.keep && existsSync(keptPath) ? keptPath : keptPath,
    findingId,
    report,
    demo: true,
  };
}
