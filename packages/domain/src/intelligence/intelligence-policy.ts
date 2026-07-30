/**
 * Typed intelligence policy eligibility plane (CLI-009 / ENG-006 / ADR-066).
 * Core projectors stay jurisdiction-agnostic; policy decides capture,
 * projection, display, export, and activation without hard-coded branches.
 */

import type { RetailerId } from "../shared/branded-id";

import type {
  ConsentPurpose,
  ConsentStatus,
  CustomerConsentState,
} from "./consent";
import {
  isPurposeGranted,
  mayCapturePersonalizationForCustomer,
} from "./consent";

export const POLICY_PLANES = [
  "capture",
  "projection",
  "display",
  "export",
  "activation",
] as const;

export type PolicyPlane = (typeof POLICY_PLANES)[number];

export const POLICY_DECISIONS = ["allow", "deny", "defer"] as const;

export type PolicyDecision = (typeof POLICY_DECISIONS)[number];

export const INTELLIGENCE_POLICY_PROJECTOR_VERSION = "intelligence-policy-v1";

/** Platform-wide defaults; retailers may override per plane/purpose. */
export interface IntelligencePolicyRule {
  readonly plane: PolicyPlane;
  readonly purpose: ConsentPurpose;
  readonly decision: PolicyDecision;
  readonly reason: string;
}

export interface IntelligencePolicyConfig {
  readonly retailerId?: RetailerId;
  readonly jurisdictionCode?: string;
  readonly anonymousCaptureAllowed: boolean;
  readonly rules: readonly IntelligencePolicyRule[];
  readonly updatedAt: string;
}

export interface PolicyEligibilityInput {
  readonly plane: PolicyPlane;
  readonly purpose: ConsentPurpose;
  readonly config: IntelligencePolicyConfig;
  readonly consent: CustomerConsentState;
}

export interface PolicyEligibilityResult {
  readonly plane: PolicyPlane;
  readonly purpose: ConsentPurpose;
  readonly decision: PolicyDecision;
  readonly reason: string;
}

export const DEFAULT_PLATFORM_POLICY_RULES: readonly IntelligencePolicyRule[] =
  [
    {
      plane: "capture",
      purpose: "personalization",
      decision: "allow",
      reason: "Explicit personalization opt-in required at capture time.",
    },
    {
      plane: "capture",
      purpose: "marketing",
      decision: "deny",
      reason: "Marketing capture stays separate from personalization signals.",
    },
    {
      plane: "capture",
      purpose: "location",
      decision: "defer",
      reason: "Location capture requires a separate explicit opt-in.",
    },
    {
      plane: "projection",
      purpose: "personalization",
      decision: "allow",
      reason: "Projectors may derive cited insights when consent is granted.",
    },
    {
      plane: "display",
      purpose: "personalization",
      decision: "allow",
      reason: "Advisor and customer surfaces may show cited conclusions.",
    },
    {
      plane: "export",
      purpose: "personalization",
      decision: "deny",
      reason: "Bulk export of personalization signals is disabled by default.",
    },
    {
      plane: "activation",
      purpose: "personalization",
      decision: "allow",
      reason: "Draft opportunities may be accepted when consent is granted.",
    },
  ];

export function buildDefaultPlatformPolicyConfig(args: {
  readonly now: string;
}): IntelligencePolicyConfig {
  return {
    anonymousCaptureAllowed: false,
    rules: DEFAULT_PLATFORM_POLICY_RULES,
    updatedAt: args.now,
  };
}

function findRule(
  config: IntelligencePolicyConfig,
  plane: PolicyPlane,
  purpose: ConsentPurpose,
): IntelligencePolicyRule | undefined {
  return config.rules.find(
    (rule) => rule.plane === plane && rule.purpose === purpose,
  );
}

function consentBlocksPurpose(
  consent: CustomerConsentState,
  purpose: ConsentPurpose,
): boolean {
  if (purpose === "personalization") {
    return !mayCapturePersonalizationForCustomer(consent);
  }
  return !isPurposeGranted(consent, purpose);
}

/**
 * Evaluate typed policy at a specific plane. Consent still fail-closes even
 * when a rule says allow.
 */
export function evaluatePolicyEligibility(
  input: PolicyEligibilityInput,
): PolicyEligibilityResult {
  const rule = findRule(input.config, input.plane, input.purpose);
  if (!rule) {
    return {
      plane: input.plane,
      purpose: input.purpose,
      decision: "deny",
      reason: "No policy rule configured for this plane and purpose.",
    };
  }

  if (rule.decision === "deny") {
    return {
      plane: input.plane,
      purpose: input.purpose,
      decision: "deny",
      reason: rule.reason,
    };
  }

  if (rule.decision === "defer") {
    return {
      plane: input.plane,
      purpose: input.purpose,
      decision: "defer",
      reason: rule.reason,
    };
  }

  if (consentBlocksPurpose(input.consent, input.purpose)) {
    const status: ConsentStatus = input.consent[input.purpose].status;
    return {
      plane: input.plane,
      purpose: input.purpose,
      decision: "deny",
      reason: `Consent ${status} blocks ${input.plane} for ${input.purpose}.`,
    };
  }

  return {
    plane: input.plane,
    purpose: input.purpose,
    decision: "allow",
    reason: rule.reason,
  };
}

export function isPolicyAllowed(result: PolicyEligibilityResult): boolean {
  return result.decision === "allow";
}
