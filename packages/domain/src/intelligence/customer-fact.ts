/**
 * Provenance-aware Self-Portrait facts (CLI-003 / PHASE 7.3 / ADR-066).
 * Four provenance classes stay distinct; inferences never silently become
 * declared or transactional facts. Employer/industry/bonus month are
 * declared-only — never inferred from occupation.
 */

import type {
  BehavioralEventId,
  CustomerFactId,
  CustomerId,
  MetadataConceptId,
  ProductId,
  RetailerId,
  StaffId,
  StylePreferenceEvidenceId,
} from "../shared/branded-id";

export const CUSTOMER_FACT_PROVENANCE_CLASSES = [
  "customer_declared",
  "advisor_observed",
  "transactional",
  "behaviour_inferred",
] as const;

export type CustomerFactProvenanceClass =
  (typeof CUSTOMER_FACT_PROVENANCE_CLASSES)[number];

export const CUSTOMER_FACT_TYPES = [
  "preference_concept",
  "occasion",
  "employer",
  "industry",
  "bonus_month",
  "anniversary",
  "wedding_date",
  "travel_window",
  "fit_note",
  "fabric_interest",
  "colour_interest",
  "pattern_interest",
  "rejected_concept",
  "other",
] as const;

export type CustomerFactType = (typeof CUSTOMER_FACT_TYPES)[number];

/** Fact types that must never be behaviour-inferred. */
export const DECLARED_ONLY_FACT_TYPES = [
  "employer",
  "industry",
  "bonus_month",
] as const satisfies readonly CustomerFactType[];

export type DeclaredOnlyFactType = (typeof DECLARED_ONLY_FACT_TYPES)[number];

export const CUSTOMER_FACT_SENSITIVITIES = [
  "standard",
  "sensitive",
  "restricted",
] as const;

export type CustomerFactSensitivity =
  (typeof CUSTOMER_FACT_SENSITIVITIES)[number];

export const CUSTOMER_FACT_VISIBILITIES = [
  "customer_and_advisor",
  "advisor_only",
  "customer_only",
] as const;

export type CustomerFactVisibility =
  (typeof CUSTOMER_FACT_VISIBILITIES)[number];

export const ADVISOR_RECTANGLE_KINDS = [
  "colour",
  "pattern",
  "fibre",
  "weave",
  "garment_type",
  "occasion",
  "formality",
  "fit",
] as const;

export type AdvisorRectangleKind = (typeof ADVISOR_RECTANGLE_KINDS)[number];

export interface CustomerFactEvidenceRef {
  readonly eventId?: BehavioralEventId;
  readonly styleEvidenceId?: StylePreferenceEvidenceId;
  readonly productId?: ProductId;
  readonly conceptId?: MetadataConceptId;
  readonly note?: string;
}

export interface CustomerFact {
  readonly id: CustomerFactId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly factType: CustomerFactType;
  readonly provenanceClass: CustomerFactProvenanceClass;
  readonly valueLabel: string;
  readonly valueConceptId?: MetadataConceptId;
  readonly valueText?: string;
  readonly confidence: number;
  readonly sensitivity: CustomerFactSensitivity;
  readonly visibility: CustomerFactVisibility;
  readonly observedAt: string;
  readonly validFrom?: string;
  readonly validUntil?: string;
  readonly reviewBy?: string;
  readonly expiresAt?: string;
  readonly authorStaffId?: StaffId;
  readonly authorCustomerId?: CustomerId;
  readonly evidence: readonly CustomerFactEvidenceRef[];
  readonly supersededByFactId?: CustomerFactId;
  readonly correctionOfFactId?: CustomerFactId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdvisorRectangleOption {
  readonly conceptId: MetadataConceptId;
  readonly kind: AdvisorRectangleKind;
  readonly label: string;
  readonly imageUrl?: string;
}

export interface AdvisorRectangleSelectionInput {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly authorStaffId: StaffId;
  readonly observedAt: string;
  readonly selections: readonly {
    readonly conceptId: MetadataConceptId;
    readonly kind: AdvisorRectangleKind;
    readonly label: string;
    readonly polarity: "positive" | "negative";
  }[];
  readonly freeformNote?: string;
}

export type CustomerFactValidationError =
  | "declared_only_cannot_be_inferred"
  | "inference_cannot_become_declared"
  | "missing_value"
  | "invalid_confidence"
  | "empty_selections";

export function isDeclaredOnlyFactType(
  value: CustomerFactType,
): value is DeclaredOnlyFactType {
  return (DECLARED_ONLY_FACT_TYPES as readonly string[]).includes(value);
}

export function mayAssignProvenance(args: {
  readonly factType: CustomerFactType;
  readonly provenanceClass: CustomerFactProvenanceClass;
}): boolean {
  if (
    isDeclaredOnlyFactType(args.factType) &&
    args.provenanceClass === "behaviour_inferred"
  ) {
    return false;
  }
  return true;
}

export function validateCustomerFactDraft(args: {
  readonly factType: CustomerFactType;
  readonly provenanceClass: CustomerFactProvenanceClass;
  readonly valueLabel: string;
  readonly confidence: number;
}): {
  readonly ok: boolean;
  readonly errors: readonly CustomerFactValidationError[];
} {
  const errors: CustomerFactValidationError[] = [];
  if (!mayAssignProvenance(args)) {
    errors.push("declared_only_cannot_be_inferred");
  }
  if (args.valueLabel.trim().length === 0) {
    errors.push("missing_value");
  }
  if (
    !Number.isFinite(args.confidence) ||
    args.confidence < 0 ||
    args.confidence > 1
  ) {
    errors.push("invalid_confidence");
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Map advisor rectangle selections into advisor-observed fact drafts.
 * Never emits customer_declared or transactional provenance.
 */
export function factsFromAdvisorRectangles(
  input: AdvisorRectangleSelectionInput,
): {
  readonly ok: boolean;
  readonly errors: readonly CustomerFactValidationError[];
  readonly drafts: readonly Omit<
    CustomerFact,
    "id" | "createdAt" | "updatedAt" | "evidence"
  >[];
} {
  if (input.selections.length === 0 && !input.freeformNote?.trim()) {
    return { ok: false, errors: ["empty_selections"], drafts: [] };
  }

  const drafts: Omit<
    CustomerFact,
    "id" | "createdAt" | "updatedAt" | "evidence"
  >[] = [];

  for (const selection of input.selections) {
    const factType: CustomerFactType =
      selection.polarity === "negative"
        ? "rejected_concept"
        : selection.kind === "colour"
          ? "colour_interest"
          : selection.kind === "pattern"
            ? "pattern_interest"
            : selection.kind === "fibre" || selection.kind === "weave"
              ? "fabric_interest"
              : selection.kind === "occasion"
                ? "occasion"
                : "preference_concept";

    const validation = validateCustomerFactDraft({
      factType,
      provenanceClass: "advisor_observed",
      valueLabel: selection.label,
      confidence: 0.9,
    });
    if (!validation.ok) {
      return { ok: false, errors: validation.errors, drafts: [] };
    }

    drafts.push({
      retailerId: input.retailerId,
      customerId: input.customerId,
      factType,
      provenanceClass: "advisor_observed",
      valueLabel: selection.label,
      valueConceptId: selection.conceptId,
      confidence: 0.9,
      sensitivity: "standard",
      visibility: "customer_and_advisor",
      observedAt: input.observedAt,
      authorStaffId: input.authorStaffId,
    });
  }

  if (input.freeformNote?.trim()) {
    drafts.push({
      retailerId: input.retailerId,
      customerId: input.customerId,
      factType: "other",
      provenanceClass: "advisor_observed",
      valueLabel: input.freeformNote.trim().slice(0, 500),
      valueText: input.freeformNote.trim().slice(0, 2000),
      confidence: 0.7,
      sensitivity: "standard",
      visibility: "advisor_only",
      observedAt: input.observedAt,
      authorStaffId: input.authorStaffId,
    });
  }

  return { ok: true, errors: [], drafts };
}

/**
 * Refuse silently promoting an inference into a declared/transactional fact.
 */
export function mayPromoteFact(args: {
  readonly from: CustomerFactProvenanceClass;
  readonly to: CustomerFactProvenanceClass;
}): boolean {
  if (args.from === args.to) return true;
  if (args.from === "behaviour_inferred") {
    return false;
  }
  return true;
}
