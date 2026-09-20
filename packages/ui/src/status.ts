/**
 * EdgeMirror design tokens — status vocabulary + color roles.
 * Visual source of truth: branding/BRAND.md + branding/STATUS.md
 */

export type EmStatus =
  | "VERIFIED"
  | "DIVERGENT"
  | "RUNNING"
  | "UNKNOWN"
  | "STALE"
  | "BLOCKED"
  | "FAILED"
  | "DEMO";

/** Parity classifications from the evidence engine (keep visible in UI). */
export type ParityClassification =
  | "MATCH"
  | "EXPECTED_DIFFERENCE"
  | "CONFIGURATION_DIFFERENCE"
  | "APPLICATION_NONDETERMINISM"
  | "POSSIBLE_RUNTIME_DIVERGENCE"
  | "RUNTIME_DIVERGENCE"
  | "INSUFFICIENT_EVIDENCE"
  | "REMOTE_NOT_CONFIGURED";

export const STATUS_LABEL: Record<EmStatus, string> = {
  VERIFIED: "Verified",
  DIVERGENT: "Divergent",
  RUNNING: "Running",
  UNKNOWN: "Unknown",
  STALE: "Stale",
  BLOCKED: "Blocked",
  FAILED: "Failed",
  DEMO: "Demo",
};

export function statusFromClassification(
  classification: string,
): EmStatus {
  switch (classification) {
    case "MATCH":
    case "EXPECTED_DIFFERENCE":
      return "VERIFIED";
    case "POSSIBLE_RUNTIME_DIVERGENCE":
    case "RUNTIME_DIVERGENCE":
    case "CONFIGURATION_DIFFERENCE":
      return "DIVERGENT";
    case "REMOTE_NOT_CONFIGURED":
      return "BLOCKED";
    case "INSUFFICIENT_EVIDENCE":
    case "APPLICATION_NONDETERMINISM":
      return "UNKNOWN";
    default:
      return "UNKNOWN";
  }
}

export function statusClass(status: EmStatus): string {
  return `em-status em-status--${status.toLowerCase()}`;
}
