/**
 * Live Cloudflare pitch demo — real local workerd + optional preview.
 * Under ~5 minutes. Never fabricates remote traces; uses REMOTE_NOT_CONFIGURED
 * when credentials are absent. Controlled divergence is labeled DEMO/PITCH.
 */

import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import pc from "picocolors";
import { LocalExecutionTarget } from "../execution/local.js";
import { PreviewExecutionTarget } from "../execution/preview.js";
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
import { createEvidenceBundle } from "../bundle/index.js";
import { EDGEMIRROR_VERSION } from "../version.js";
import { detectCloudflareAuth } from "../adapters/cloudflare/auth.js";
import { DEMO_FINDING_PREFIX, DEMO_MARKER } from "./constants.js";

export interface PitchDemoOptions {
  quiet?: boolean;
  keep?: boolean;
  /** Existing preview URL (skips versions upload) */
  previewUrl?: string;
  /**
   * When remote/preview is unavailable, optionally synthesize a DEMO remote
   * for offline rehearsal. Default false — prefer honest REMOTE_NOT_CONFIGURED.
   */
  synthesizeDemoRemote?: boolean;
}

export interface PitchDemoResult {
  exitCode: number;
  tempDir: string;
  findingId?: string;
  remoteStatus: "configured" | "REMOTE_NOT_CONFIGURED" | "demo-synthesized";
  report: RunReport;
  elapsedMs: number;
  pitch: true;
}

const LOCAL_BODY = "pitch-local-ok";
const REMOTE_DIVERGENT_BODY = "pitch-remote-divergent";

function writePitchWorker(root: string, body: string): void {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "wrangler.jsonc"),
    `{
  "name": "edgemirror-pitch-demo",
  "main": "src/index.ts",
  "compatibility_date": "2025-04-01",
  "workers_dev": true
}
`,
    "utf8",
  );
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify(
      {
        name: "edgemirror-pitch-demo",
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
    return new Response(${JSON.stringify(body)}, {
      status: 200,
      headers: { "content-type": "text/plain;charset=UTF-8" },
    });
  },
};
`,
    "utf8",
  );
  writeFileSync(
    join(root, "PITCH.md"),
    `# EdgeMirror pitch demo

Isolated Worker for \`edgemirror pitch-demo\` / \`edgemirror demo cloudflare\`.

- Findings use \`${DEMO_FINDING_PREFIX}*\` / ${DEMO_MARKER} labels when synthesized
- Live preview path uses real Cloudflare when credentials exist
- Never mix evidence into a caller project's corpus
`,
    "utf8",
  );
}

/**
 * Deterministic live demo suitable for a technical meeting (<5 min).
 *
 * Flow: isolated Worker → real local workerd → Cloudflare preview (if auth)
 * → controlled divergence detection → receipt → evidence bundle.
 */
export async function runPitchDemo(
  options: PitchDemoOptions = {},
): Promise<PitchDemoResult> {
  const started = Date.now();
  const tempDir = mkdtempSync(join(tmpdir(), "edgemirror-pitch-"));
  writePitchWorker(tempDir, LOCAL_BODY);

  const artifacts = join(tempDir, ".edgemirror");
  const ownershipDir = join(artifacts, "ownership");
  mkdirSync(ownershipDir, { recursive: true });
  const runId = `pitch-${randomUUID().slice(0, 8)}`;
  const runDir = join(artifacts, "runs", runId);
  mkdirSync(join(runDir, "traces"), { recursive: true });
  mkdirSync(join(runDir, "receipts"), { recursive: true });
  mkdirSync(join(runDir, "reports"), { recursive: true });

  const fp = createFingerprint({
    projectRoot: tempDir,
    workerName: "edgemirror-pitch-demo",
    entryPoint: "src/index.ts",
    compatibilityDate: "2025-04-01",
    compatibilityFlags: [],
    bindings: emptyBindingSummary(),
  });

  const test = {
    id: "pitch-http-get-root",
    name: "Pitch demo GET /",
    request: { method: "GET", path: "/" },
  };

  const execCtx = {
    projectRoot: tempDir,
    wranglerConfigPath: join(tempDir, "wrangler.jsonc"),
    configurationFingerprint: fp,
    ownershipDir,
  };

  if (!options.quiet) {
    console.log("");
    console.log(pc.bold("═══ EdgeMirror pitch-demo ═══"));
    console.log(pc.dim("Isolated Worker · real local workerd · optional Cloudflare preview"));
    console.log(pc.dim(`Temp: ${tempDir}`));
    console.log("");
    console.log("1/5  Preparing local workerd…");
  }

  const local = new LocalExecutionTarget(execCtx);
  let localFailed = false;
  let localTrace;
  try {
    await local.prepare();
    if (!options.quiet) console.log("2/5  Executing local request…");
    localTrace = await local.execute(test);
  } catch (err) {
    localFailed = true;
    const message = err instanceof Error ? err.message : String(err);
    if (!options.quiet) {
      console.error(pc.red(`Local prepare/execute failed: ${message}`));
    }
    await local.cleanup().catch(() => undefined);
    const report = emptyPitchReport({
      runId,
      tempDir,
      remoteStatus: "REMOTE_NOT_CONFIGURED",
      remoteReason: `Local failed: ${message}`,
      started,
    });
    return {
      exitCode: 2,
      tempDir,
      remoteStatus: "REMOTE_NOT_CONFIGURED",
      report,
      elapsedMs: Date.now() - started,
      pitch: true,
    };
  } finally {
    if (!localFailed) {
      /* cleanup after remote attempt */
    }
  }

  const auth = detectCloudflareAuth();
  // For controlled divergence on a live path: rewrite Worker body before preview/remote.
  writePitchWorker(tempDir, REMOTE_DIVERGENT_BODY);

  let remoteStatus: PitchDemoResult["remoteStatus"] = "REMOTE_NOT_CONFIGURED";
  let remoteReason: string | undefined;
  let remoteTrace;

  if (!options.quiet) {
    console.log(
      `3/5  Cloudflare auth: ${auth.label}${auth.configured ? "" : " → REMOTE_NOT_CONFIGURED if preview fails"}`,
    );
    console.log("4/5  Attempting Cloudflare preview…");
  }

  const preview = new PreviewExecutionTarget(execCtx, {
    existingUrl: options.previewUrl,
  });
  await preview.prepare();
  const prep = preview.getPrepareStatus();

  if (prep.configured) {
    remoteTrace = await preview.execute(test);
    if (remoteTrace.status === "ok") {
      remoteStatus = "configured";
    } else if (remoteTrace.status === "REMOTE_NOT_CONFIGURED") {
      remoteStatus = "REMOTE_NOT_CONFIGURED";
      remoteReason = remoteTrace.statusReason;
    } else {
      remoteStatus = "REMOTE_NOT_CONFIGURED";
      remoteReason =
        remoteTrace.statusReason ??
        "Preview execute failed (infrastructure — not a parity claim)";
      // Keep error status on trace so classify → INSUFFICIENT_EVIDENCE
    }
  } else {
    remoteReason = prep.reason;
    if (options.synthesizeDemoRemote) {
      const obs = emptyObservations();
      obs.http.status = captured(200);
      obs.http.body = captured(REMOTE_DIVERGENT_BODY);
      obs.http.headers = captured({ "content-type": "text/plain;charset=UTF-8" });
      obs.http.bodyEncoding = captured("utf8");
      obs.notes.push(
        "DEMO/PITCH: synthesized remote — NOT a live Cloudflare response",
        "Enabled via --synthesize-demo-remote for offline rehearsal only",
      );
      remoteTrace = createTrace({
        testId: test.id,
        target: "remote",
        status: "ok",
        statusReason:
          "DEMO/PITCH synthesized remote (not live Cloudflare) — for illustration only",
        configurationFingerprint: fp,
        observations: obs,
      });
      remoteStatus = "demo-synthesized";
      remoteReason = remoteTrace.statusReason;
    } else {
      remoteTrace = createTrace({
        testId: test.id,
        target: "remote",
        status: "REMOTE_NOT_CONFIGURED",
        statusReason: remoteReason,
        configurationFingerprint: fp,
        observations: emptyObservations(),
      });
    }
  }

  await preview.cleanup().catch(() => undefined);
  await local.cleanup().catch(() => undefined);

  // Restore local body reference in notes — localTrace already captured LOCAL_BODY
  const findingId =
    remoteStatus === "configured" || remoteStatus === "demo-synthesized"
      ? `${DEMO_FINDING_PREFIX}PITCH-001`
      : undefined;

  const localPath = writeTrace(join(runDir, "traces"), localTrace!);
  const remotePath = writeTrace(join(runDir, "traces"), remoteTrace!);

  const result = buildParityResult({
    testId: test.id,
    local: localTrace!,
    remote: remoteTrace!,
    findingId,
    expectedBehavior:
      remoteStatus === "demo-synthesized" ? "expected_difference" : undefined,
  });

  if (findingId && result.classification !== "REMOTE_NOT_CONFIGURED") {
    const receipt = createReceipt({
      findingId,
      result,
      localTrace: localTrace!,
      remoteTrace: remoteTrace!,
      artifactPaths: [localPath, remotePath],
      notes: [
        remoteStatus === "demo-synthesized"
          ? "DEMO/PITCH: intentional controlled divergence — not production evidence"
          : "PITCH: controlled local vs preview body divergence for demonstration",
        `Isolated temp dir: ${tempDir}`,
      ],
    });
    writeReceipt(join(runDir, "receipts"), receipt);
  }

  const report: RunReport = {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date().toISOString(),
    projectRoot: tempDir,
    results: [result],
    score: scoreParityResults([result]),
    remoteStatus:
      remoteStatus === "configured"
        ? "configured"
        : remoteStatus === "demo-synthesized"
          ? "configured"
          : "REMOTE_NOT_CONFIGURED",
    remoteReason,
    checks: [
      {
        id: "pitch-local",
        name: "Local workerd",
        status: localTrace!.status === "ok" ? "passed" : "failed",
      },
      {
        id: "pitch-preview",
        name: "Cloudflare preview",
        status:
          remoteStatus === "configured"
            ? "passed"
            : remoteStatus === "demo-synthesized"
              ? "skipped"
              : "unavailable",
        reason:
          remoteStatus === "configured"
            ? prep.previewUrl
            : remoteStatus === "demo-synthesized"
              ? "DEMO synthesized remote"
              : "REMOTE_NOT_CONFIGURED",
        detail: remoteReason,
      },
    ],
  };

  writeReports(join(runDir, "reports"), report, ["terminal", "json"]);
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(runDir, "PITCH.md"),
    `# Pitch demo ${runId}

- Elapsed: ${Date.now() - started}ms
- Remote: ${remoteStatus}
- Finding: ${findingId ?? "(none — remote not configured)"}
- Auth: ${auth.label}

${
  remoteStatus === "REMOTE_NOT_CONFIGURED"
    ? "Set CLOUDFLARE_API_TOKEN for the full local→preview flow. Local evidence above is real."
    : "Controlled divergence detected and recorded."
}
`,
    "utf8",
  );

  if (findingId) {
    try {
      createEvidenceBundle({ projectRoot: tempDir, targetId: findingId });
    } catch {
      /* best-effort */
    }
  }

  if (!options.quiet) {
    console.log("5/5  Report");
    console.log("");
    console.log(formatTerminalReport(report));
    console.log("");
    const elapsed = Date.now() - started;
    console.log(pc.dim(`Elapsed ${elapsed}ms (target < 5 minutes)`));
    if (remoteStatus === "REMOTE_NOT_CONFIGURED") {
      console.log(
        pc.yellow(
          "REMOTE_NOT_CONFIGURED — local workerd ran for real; preview skipped without inventing results.",
        ),
      );
      console.log(
        pc.dim(
          "Tip: set CLOUDFLARE_API_TOKEN, or pass --synthesize-demo-remote for offline rehearsal.",
        ),
      );
    }
  }

  if (!options.keep) {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }

  return {
    exitCode: 0,
    tempDir,
    findingId,
    remoteStatus,
    report,
    elapsedMs: Date.now() - started,
    pitch: true,
  };
}

function emptyPitchReport(input: {
  runId: string;
  tempDir: string;
  remoteStatus: RunReport["remoteStatus"];
  remoteReason: string;
  started: number;
}): RunReport {
  return {
    schemaVersion: "1.0",
    edgemirrorVersion: EDGEMIRROR_VERSION,
    runId: input.runId,
    startedAt: new Date(input.started).toISOString(),
    finishedAt: new Date().toISOString(),
    projectRoot: input.tempDir,
    results: [],
    score: scoreParityResults([]),
    remoteStatus: input.remoteStatus,
    remoteReason: input.remoteReason,
    checks: [
      {
        id: "pitch-local",
        name: "Local workerd",
        status: "failed",
        reason: input.remoteReason,
      },
    ],
  };
}
