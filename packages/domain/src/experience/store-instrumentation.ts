/**
 * Instrumented physical store and vertical packs
 * (EXP-101 / PHASE 16.4, and the 16.3 pack framework).
 *
 * 16.4's non-goals are unusually serious: no fake virtual-fit precision,
 * no covert biometric identity, no camera-derived employee accusation.
 * Each is a refusal here.
 *
 * `checkObservationAdapter` refuses any adapter that claims identity from
 * a camera, and refuses any observation that carries a staff id — a zone
 * sensor that can tell you which advisor stood where for how long is a
 * productivity monitor, whatever it was installed for. Anonymous presence
 * counting is allowed because it genuinely is anonymous: the adapter
 * contract has nowhere to put an identity.
 *
 * `assessVirtualFit` never returns a measurement. It returns a
 * *comparison band* and a required disclaimer, because a mirror that says
 * "42mm too long" implies an accuracy no display has, and the customer
 * will believe it.
 */

export const OBSERVATION_ADAPTER_KINDS = [
  "anonymous_presence_count",
  "zone_dwell_anonymous",
  "display_interaction",
  "garment_tag_scan",
] as const;
export type ObservationAdapterKind = (typeof OBSERVATION_ADAPTER_KINDS)[number];

export type AdapterCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "biometric_identity_not_permitted"
        | "staff_attribution_not_permitted"
        | "customer_identity_requires_consent";
    };

/**
 * The gate every observation adapter passes. Three refusals:
 *
 * - Facial or gait identification is refused outright. There is no consent
 *   flag that enables it, because covert biometric identity is the
 *   non-goal and a consent checkbox on a shop door is not consent.
 * - An observation carrying a staff id is refused. A zone sensor that can
 *   report which advisor stood where becomes a productivity monitor the
 *   day someone asks it to.
 * - A named customer observation requires that customer's recorded
 *   consent, which is a different and much narrower thing: a client who
 *   asked to be greeted by name at the door.
 */
export function checkObservationAdapter(args: {
  readonly kind: ObservationAdapterKind;
  readonly claimsBiometricIdentity: boolean;
  readonly carriesStaffId: boolean;
  readonly carriesCustomerId: boolean;
  readonly customerConsentRecorded?: boolean;
}): AdapterCheck {
  if (args.claimsBiometricIdentity) {
    return { ok: false, reason: "biometric_identity_not_permitted" };
  }
  if (args.carriesStaffId) {
    return { ok: false, reason: "staff_attribution_not_permitted" };
  }
  if (args.carriesCustomerId && !args.customerConsentRecorded) {
    return { ok: false, reason: "customer_identity_requires_consent" };
  }
  return { ok: true };
}

export const STORE_FEEDBACK_AUDIENCES = [
  "buying",
  "merchandising",
  "client_experience",
] as const;
export type StoreFeedbackAudience = (typeof STORE_FEEDBACK_AUDIENCES)[number];

/** Manual feedback is explicit, but named context still fails closed without
 * personalization consent. There is intentionally no employee field here. */
export function checkStoreFeedbackContext(args: {
  readonly customerId?: string;
  readonly garmentRef?: string;
  readonly personalizationConsent?: "granted" | "denied" | "withdrawn";
}):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "context_required" | "customer_consent_required";
    } {
  if (!args.customerId && !args.garmentRef?.trim())
    return { ok: false, reason: "context_required" };
  if (args.customerId && args.personalizationConsent !== "granted")
    return { ok: false, reason: "customer_consent_required" };
  return { ok: true };
}

export const FIT_COMPARISON_BANDS = [
  "noticeably_short",
  "slightly_short",
  "as_expected",
  "slightly_long",
  "noticeably_long",
] as const;
export type FitComparisonBand = (typeof FIT_COMPARISON_BANDS)[number];

export interface VirtualFitResult {
  readonly band: FitComparisonBand;
  /** Always present. A display that shows a fit judgement without saying
   * what it is cannot help but be read as a measurement. */
  readonly disclaimer: string;
  /** Deliberately absent as a concept: see the module docblock. */
  readonly millimetres?: never;
}

export const VIRTUAL_FIT_DISCLAIMER =
  "On-screen guidance only. Not a measurement — confirm with your fitter.";

/**
 * Returns a band, never a number. The type makes the number impossible:
 * `millimetres?: never` means a future contributor adding one has to
 * change the type first, which is a conversation rather than a commit.
 */
export function assessVirtualFit(args: {
  readonly observedDifferenceMillimetres: number;
}): VirtualFitResult {
  const difference = args.observedDifferenceMillimetres;
  const band: FitComparisonBand =
    difference <= -25
      ? "noticeably_short"
      : difference <= -8
        ? "slightly_short"
        : difference < 8
          ? "as_expected"
          : difference < 25
            ? "slightly_long"
            : "noticeably_long";
  return { band, disclaimer: VIRTUAL_FIT_DISCLAIMER };
}

export interface StoreSessionStep {
  readonly zoneKey: string;
  readonly action: string;
  readonly occurredAt: string;
  readonly garmentRef?: string;
}

export type SessionLinkCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "no_customer_approved_look"
        | "outcome_requires_advisor"
        | "device_failure_needs_manual_fallback";
    };

/**
 * Closing an in-store session. A recorded outcome requires a look the
 * customer actually approved — otherwise the store's own instrumentation
 * becomes the record of what the customer "wanted".
 *
 * Device failure is not an error state here. It sets
 * `manualFallbackUsed`, and a session completed on paper is as valid as
 * one completed on a mirror; the acceptance criterion says exactly that.
 */
export function checkSessionOutcome(args: {
  readonly customerApprovedLookRef?: string;
  readonly advisorStaffId?: string;
  readonly deviceFailed: boolean;
  readonly manualFallbackUsed: boolean;
}): SessionLinkCheck {
  if (args.deviceFailed && !args.manualFallbackUsed) {
    return { ok: false, reason: "device_failure_needs_manual_fallback" };
  }
  if (!args.customerApprovedLookRef) {
    return { ok: false, reason: "no_customer_approved_look" };
  }
  if (!args.advisorStaffId) {
    return { ok: false, reason: "outcome_requires_advisor" };
  }
  return { ok: true };
}

export interface ComparisonRecord {
  readonly constructionKind: "half_canvas" | "full_canvas" | "handmade";
  readonly customerPreferred: boolean;
  readonly notedReason: string;
}

export type ComparisonCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "reason_required" | "no_preference_recorded";
    };

/**
 * A guided comparison records what the customer preferred **and why**. The
 * reason is the entire value: "chose full canvas" is a sale, "chose full
 * canvas because the chest felt softer" is something the next advisor can
 * use.
 */
export function checkComparison(args: {
  readonly records: readonly ComparisonRecord[];
}): ComparisonCheck {
  const preferred = args.records.filter((record) => record.customerPreferred);
  if (preferred.length === 0) {
    return { ok: false, reason: "no_preference_recorded" };
  }
  for (const record of preferred) {
    if (record.notedReason.trim().length < 5) {
      return { ok: false, reason: "reason_required" };
    }
  }
  return { ok: true };
}

export interface VerticalPack {
  readonly verticalKey: string;
  /** Terminology overrides, e.g. "garment" -> "instrument". */
  readonly terminology: Readonly<Record<string, string>>;
  readonly formKeys: readonly string[];
  readonly workflowKeys: readonly string[];
  readonly sensitiveFieldKeys: readonly string[];
}

export type PackCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "forks_core_entity"
        | "sensitive_field_needs_declaration"
        | "terminology_collides_with_core";
      readonly detail?: string;
    };

/**
 * The 16.3 extension contract. A vertical pack may rename things, add
 * forms and add workflows. It may **not** introduce an entity that
 * duplicates a core one — that is the "no core fork" the acceptance
 * criterion names, and it is checked by rejecting any declared entity
 * whose key matches a core entity.
 */
export function checkVerticalPack(args: {
  readonly pack: VerticalPack;
  readonly coreEntityKeys: readonly string[];
  readonly declaredEntityKeys: readonly string[];
  readonly declaredSensitiveFieldKeys: readonly string[];
}): PackCheck {
  const core = new Set(args.coreEntityKeys);
  for (const key of args.declaredEntityKeys) {
    if (core.has(key)) {
      return { ok: false, reason: "forks_core_entity", detail: key };
    }
  }
  for (const key of Object.keys(args.pack.terminology)) {
    if (!core.has(key)) {
      // Renaming something the core does not have is a typo, not an
      // override, and it will silently do nothing.
      return {
        ok: false,
        reason: "terminology_collides_with_core",
        detail: key,
      };
    }
  }
  const declared = new Set(args.declaredSensitiveFieldKeys);
  for (const key of args.pack.sensitiveFieldKeys) {
    if (!declared.has(key)) {
      return {
        ok: false,
        reason: "sensitive_field_needs_declaration",
        detail: key,
      };
    }
  }
  return { ok: true };
}

export const VERTICAL_SELECTION_NOTE =
  "A second vertical is selected from actual prospect evidence, never " +
  "speculatively. The framework is buildable now; the pilot is not.";
