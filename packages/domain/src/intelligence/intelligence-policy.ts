/**
 * Capability/policy eligibility plane (CLI-009 / ENG-006 / PHASE 7.8 / ADR-066).
 * Core projectors accept eligibility decisions; they do not embed
 * jurisdiction branches. Engineering invariants (tenant isolation, no
 * secrets/payment capture) are never optional.
 */

export const INTELLIGENCE_POLICY_PURPOSES = [
  "capture",
  "projection",
  "display",
  "export",
  "activation",
] as const;

export type IntelligencePolicyPurpose =
  (typeof INTELLIGENCE_POLICY_PURPOSES)[number];

export const INTELLIGENCE_RETENTION_CLASSES = [
  "personalization_signal",
  "operational_analytics",
  "ephemeral",
] as const;

export type IntelligenceRetentionClass =
  (typeof INTELLIGENCE_RETENTION_CLASSES)[number];

export interface IntelligencePolicyConfig {
  readonly id: string;
  readonly retailerId: string | null;
  /** Optional jurisdiction/tenant tag — not hard-coded into projectors. */
  readonly jurisdictionTag?: string;
  readonly allowAnonymousCapture: boolean;
  readonly allowPersonalizationProjection: boolean;
  readonly allowAdvisorDisplay: boolean;
  readonly allowCustomerDisplay: boolean;
  readonly allowExport: boolean;
  readonly allowActivation: boolean;
  readonly retentionDaysPersonalization: number;
  readonly fieldMask: readonly string[];
  readonly version: string;
}

export const DEFAULT_INTELLIGENCE_POLICY: IntelligencePolicyConfig = {
  id: "default-capability-first",
  retailerId: null,
  allowAnonymousCapture: false,
  allowPersonalizationProjection: true,
  allowAdvisorDisplay: true,
  allowCustomerDisplay: true,
  allowExport: false,
  allowActivation: false,
  retentionDaysPersonalization: 365,
  fieldMask: ["password", "cardNumber", "cvv", "credentials", "rawForm"],
  version: "intelligence-policy-v1",
};

export interface EligibilityDecision {
  readonly allowed: boolean;
  readonly purpose: IntelligencePolicyPurpose;
  readonly reasonCodes: readonly string[];
  readonly policyVersion: string;
  readonly fieldMask: readonly string[];
}

export function evaluateIntelligenceEligibility(args: {
  readonly policy: IntelligencePolicyConfig;
  readonly purpose: IntelligencePolicyPurpose;
  readonly personalizationConsentGranted: boolean;
  readonly isAnonymous?: boolean;
  readonly role?: "customer" | "advisor" | "owner" | "admin_ops";
}): EligibilityDecision {
  const reasons: string[] = [];
  const policy = args.policy;

  if (args.isAnonymous && !policy.allowAnonymousCapture) {
    reasons.push("anonymous_capture_disabled");
  }
  if (
    args.purpose === "capture" &&
    !args.isAnonymous &&
    !args.personalizationConsentGranted
  ) {
    reasons.push("personalization_consent_required");
  }
  if (args.purpose === "projection" && !policy.allowPersonalizationProjection) {
    reasons.push("projection_disabled_by_policy");
  }
  if (
    args.purpose === "display" &&
    args.role === "advisor" &&
    !policy.allowAdvisorDisplay
  ) {
    reasons.push("advisor_display_disabled");
  }
  if (
    args.purpose === "display" &&
    args.role === "customer" &&
    !policy.allowCustomerDisplay
  ) {
    reasons.push("customer_display_disabled");
  }
  if (args.purpose === "export" && !policy.allowExport) {
    reasons.push("export_disabled_by_policy");
  }
  if (args.purpose === "activation" && !policy.allowActivation) {
    reasons.push("activation_disabled_draft_only");
  }

  // Engineering invariants always apply via fieldMask even when allowed.
  return {
    allowed: reasons.length === 0,
    purpose: args.purpose,
    reasonCodes: reasons,
    policyVersion: policy.version,
    fieldMask: policy.fieldMask,
  };
}

export function maskForbiddenFields(
  properties: Readonly<Record<string, unknown>>,
  fieldMask: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (fieldMask.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * After a correction/deletion, projectors must recompute or expire.
 * Pure contract for replay orchestration.
 */
export function correctionRequiresRecompute(args: {
  readonly correctedFactTypes: readonly string[];
  readonly affectedProjectorVersions: readonly string[];
}): {
  readonly recomputeInterest: boolean;
  readonly recomputeForYou: boolean;
  readonly expireOpportunities: boolean;
  readonly projectorVersions: readonly string[];
} {
  const touchesPreferences = args.correctedFactTypes.some((type) =>
    [
      "colour_interest",
      "pattern_interest",
      "fabric_interest",
      "rejected_concept",
      "preference_concept",
      "occasion",
    ].includes(type),
  );
  return {
    recomputeInterest: touchesPreferences,
    recomputeForYou: touchesPreferences,
    expireOpportunities: touchesPreferences,
    projectorVersions: args.affectedProjectorVersions,
  };
}
