/**
 * Resource discovery and adaptive concurrency recommendations.
 * Measure-based — not "CPU count alone".
 */

import os from "node:os";
import type { GovernorMode, ResourceSnapshot } from "./types.js";

export function captureResources(opts?: {
  mode?: GovernorMode;
  remoteLatencyMs?: number;
  rateLimitRemaining?: number;
  queueDepth?: number;
}): ResourceSnapshot {
  const cpus = Math.max(1, os.cpus().length);
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const load = os.loadavg()?.[0];
  const mode = opts?.mode ?? "BALANCED";

  const recommended = recommendConcurrency({
    cpus,
    freeMemMb,
    loadAvg1m: load,
    mode,
    remoteLatencyMs: opts?.remoteLatencyMs,
    rateLimitRemaining: opts?.rateLimitRemaining,
    queueDepth: opts?.queueDepth,
  });

  return {
    capturedAt: new Date().toISOString(),
    cpus,
    freeMemMb,
    totalMemMb,
    loadAvg1m: Number.isFinite(load) ? load : undefined,
    platform: process.platform,
    nodeVersion: process.version,
    recommendedConcurrency: recommended,
  };
}

export function recommendConcurrency(input: {
  cpus: number;
  freeMemMb: number;
  loadAvg1m?: number;
  mode: GovernorMode;
  remoteLatencyMs?: number;
  rateLimitRemaining?: number;
  queueDepth?: number;
}): number {
  const { cpus, freeMemMb, mode } = input;

  // Memory floor: leave headroom for wrangler/workerd (~256MB soft for I/O fan-out).
  // Synthetic / lightweight jobs need far less than 512MB each.
  const memSlots = Math.max(1, Math.floor(freeMemMb / 256));

  let base: number;
  switch (mode) {
    case "ECO":
      base = 1;
      break;
    case "BALANCED":
      base = Math.max(2, Math.min(8, Math.ceil(cpus / 2)));
      break;
    case "FAST":
      base = Math.max(4, Math.min(32, cpus * 2));
      break;
    case "MAX":
      // I/O-bound fan-out: allow well above CPU count (timer/network bound).
      base = Math.max(8, Math.min(128, Math.max(cpus * 4, 64)));
      break;
  }

  let conc = Math.min(base, memSlots);

  // High load → back off
  if (input.loadAvg1m !== undefined && input.loadAvg1m > cpus * 0.85) {
    conc = Math.max(1, Math.floor(conc / 2));
  }

  // Remote latency / rate limits constrain outbound fan-out
  if (input.remoteLatencyMs !== undefined && input.remoteLatencyMs > 1500) {
    conc = Math.max(1, Math.min(conc, 2));
  }
  if (input.rateLimitRemaining !== undefined && input.rateLimitRemaining < 10) {
    conc = 1;
  }

  // Deep queues: raise toward mode base (large microbenches / matrices)
  if (input.queueDepth !== undefined && input.queueDepth > 50 && mode !== "ECO") {
    const boost =
      input.queueDepth >= 500 ? Math.min(base, conc + Math.ceil(base / 2)) : conc + 2;
    conc = Math.min(boost, base, memSlots);
  }

  return Math.max(1, conc);
}

export function formatResourceDoctor(snapshot: ResourceSnapshot): string {
  const lines = [
    "EdgeMirror Supercharger — resource doctor",
    `(measurements only; not a speedup claim)`,
    "",
    `Platform:     ${snapshot.platform}`,
    `Node:         ${snapshot.nodeVersion}`,
    `CPUs:         ${snapshot.cpus}`,
    `Memory free:  ${snapshot.freeMemMb} MB / ${snapshot.totalMemMb} MB`,
    snapshot.loadAvg1m !== undefined
      ? `Load (1m):    ${snapshot.loadAvg1m.toFixed(2)}`
      : `Load (1m):    n/a`,
    `Recommended:  concurrency ${snapshot.recommendedConcurrency}`,
    `Captured:     ${snapshot.capturedAt}`,
  ];
  return lines.join("\n");
}
