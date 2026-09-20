/**
 * Performance gates for Agent 6 release checks.
 * Thresholds are soft/statistically modest — fail only on clear regressions of the microbench harness.
 */

import type { MicrobenchResult } from "./benchmark.js";

export interface PerfGate {
  id: string;
  description: string;
  /** soft | hard — hard fails CI when wired by Agent 6 */
  severity: "soft" | "hard";
  check: (bench: MicrobenchResult) => {
    pass: boolean;
    detail: string;
  };
}

export const PERFORMANCE_GATES: PerfGate[] = [
  {
    id: "microbench-completes",
    description: "Synthetic microbench finishes and reports measurements",
    severity: "hard",
    check: (b) => ({
      pass: b.standard.wallMs > 0 && b.supercharger.wallMs > 0,
      detail: `standard=${b.standard.wallMs}ms supercharger=${b.supercharger.wallMs}ms`,
    }),
  },
  {
    id: "scheduler-not-slower-than-3x",
    description:
      "Scheduler wall time should not be >3× sequential on synthetic I/O (catastrophic regression)",
    severity: "hard",
    check: (b) => {
      const pass = b.supercharger.wallMs <= b.standard.wallMs * 3 + 50;
      return {
        pass,
        detail: `ratio=${(b.supercharger.wallMs / b.standard.wallMs).toFixed(3)} (limit 3.0)`,
      };
    },
  },
  {
    id: "cu-accounting-present",
    description: "CU ledger records usage (accounting only)",
    severity: "hard",
    check: (b) => ({
      pass: b.supercharger.cuUsed > 0,
      detail: `cuUsed=${b.supercharger.cuUsed}`,
    }),
  },
  {
    id: "no-fake-speedup-field",
    description: "Results must expose measured ratio only (no marketing speedup field)",
    severity: "hard",
    check: (b) => {
      const keys = Object.keys(b.ratio);
      const pass =
        keys.length === 1 && keys[0] === "wallSpeedupMeasured" && "disclaimer" in b;
      return { pass, detail: `ratioKeys=${keys.join(",")}` };
    },
  },
];

export interface GateReport {
  passed: boolean;
  results: Array<{
    id: string;
    severity: "soft" | "hard";
    pass: boolean;
    detail: string;
    description: string;
  }>;
}

export function evaluatePerfGates(bench: MicrobenchResult): GateReport {
  const results = PERFORMANCE_GATES.map((g) => {
    const r = g.check(bench);
    return {
      id: g.id,
      severity: g.severity,
      pass: r.pass,
      detail: r.detail,
      description: g.description,
    };
  });
  const passed = results.every((r) => r.pass || r.severity === "soft");
  const hardFail = results.some((r) => !r.pass && r.severity === "hard");
  return { passed: passed && !hardFail, results };
}
