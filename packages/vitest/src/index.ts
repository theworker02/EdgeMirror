/**
 * EdgeMirror Vitest adapter — thin reporter that writes a summary artifact.
 * Does not replace @cloudflare/vitest-pool-workers or Vitest itself.
 */

export { EdgeMirrorVitestReporter } from "./reporter.js";
export const ADAPTER_ID = "edgemirror-vitest";
