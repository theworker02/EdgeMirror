/**
 * Platform-agnostic adapter interfaces.
 * Cloudflare is the only production-quality target in v1/v2.
 */

import type { ExecutionTrace, ParityTest } from "../trace/schema.js";

export interface RuntimeAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly kind: "local" | "remote" | "preview";
  isAvailable(): Promise<{ available: boolean; reason?: string }>;
  prepare?(): Promise<void>;
  execute(test: ParityTest): Promise<ExecutionTrace>;
  cleanup?(): Promise<void>;
}

export interface BindingAdapter {
  readonly id: string;
  readonly bindingType: string;
  summarize(config: unknown): Record<string, unknown>;
}

export interface ReporterAdapter {
  readonly id: string;
  readonly format: string;
  render(report: unknown): string;
}

export interface TestRunnerAdapter {
  readonly id: string;
  readonly displayName: string;
  detect(projectRoot: string): Promise<{
    detected: boolean;
    details?: Record<string, unknown>;
  }>;
  run?(opts: {
    projectRoot: string;
    args?: string[];
  }): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export const CLOUDFLARE_ADAPTER_ID = "cloudflare-workers";
