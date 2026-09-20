/**
 * @edgemirror/billing — Stripe subscriptions, entitlements, CU metering for EdgeMirror Cloud.
 */

export {
  DEFAULT_PLANS,
  OSS_ALTERNATIVE_MESSAGE,
  createPlanCatalog,
  upgradeSuggestion,
  type PlanId,
  type EntitlementKey,
  type PlanDefinition,
  type PlanCatalog,
} from "./plans.js";

export {
  createEntitlementService,
  gateManagedSupercharger,
  gateCloudHistory,
  gateScheduledVerification,
  gateExtendedCompatMatrix,
  gatePrivateProjects,
  type OrgBillingSnapshot,
  type EntitlementService,
} from "./entitlements.js";

export {
  createMemoryCuMeterStore,
  createCuMeter,
  currentCuPeriod,
  getCuBudget,
  type CuUsageRecord,
  type CuMeterStore,
  type CuMeter,
  type CuConsumeResult,
} from "./metering.js";

export {
  loadBillingConfig,
  createStripeClient,
  createBillingClients,
  type BillingMode,
  type StripeEnvConfig,
  type BillingConfigResult,
  type BillingClients,
  type StripeLike,
} from "./stripe-client.js";

export {
  createCheckoutSession,
  createCustomerPortalSession,
  type CheckoutRequest,
  type CheckoutResult,
  type PortalResult,
} from "./checkout.js";

export {
  createMemoryWebhookEventStore,
  constructStripeEvent,
  handleStripeWebhook,
  type WebhookEventStore,
  type WebhookHandleResult,
  type WebhookDeps,
} from "./webhooks.js";

export { getBillingStatus, type BillingStatusView } from "./status.js";
