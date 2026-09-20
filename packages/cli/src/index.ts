/**
 * Public library exports for @edgemirror/cli
 */

export { EDGEMIRROR_VERSION } from "./version.js";
export * from "./trace/schema.js";
export * from "./trace/factory.js";
export { loadConfig, writeDefaultConfig, DEFAULT_CONFIG } from "./config/index.js";
export {
  discoverProject,
  formatDoctorReport,
  EdgeMirrorDiscoveryError,
  parseWranglerConfig,
} from "./discovery/index.js";
export { discoverZeroConfig } from "./discovery/zeroconfig.js";
export { normalizeTrace, listNormalizationRules } from "./normalizer/index.js";
export {
  compareTraces,
  classifyComparison,
  buildParityResult,
  scoreParityResults,
} from "./diff/index.js";
export { runParitySuite } from "./orchestrator/index.js";
export { runVerify } from "./verify/index.js";
export { createEvidenceBundle, verifyBundle } from "./bundle/index.js";
export { BUILTIN_CORPUS, selectTests } from "./corpus/index.js";
