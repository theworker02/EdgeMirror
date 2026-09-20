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
  summarizeBindings,
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
export {
  CLOUDFLARE_ADAPTER_ID,
  CLOUDFLARE_BINDING_SUPPORT,
  buildCloudflareSupportReport,
  detectCloudflareAuth,
  classifyInfraFailure,
  formatBindingsSupportTable,
  CloudflareBindingAdapter,
  CloudflareLocalAdapter,
  CloudflareRemoteAdapter,
  CloudflarePreviewAdapter,
} from "./adapters/cloudflare/index.js";
export { runDemo, runPitchDemo, resetDemoResources } from "./demo/index.js";
export { runCompatMatrix } from "./compat/index.js";
export {
  runScheduler,
  buildParityDag,
  buildSuperchargePlan,
  evaluatePerfGates,
  runMicrobench,
  selectForMode,
  pruneCompatMatrix,
  startRunner,
  type SuperchargeOptions,
  type GovernorMode,
} from "./supercharger/index.js";
export * from "./security/index.js";
export { redactString, redactDeep } from "./privacy/index.js";
