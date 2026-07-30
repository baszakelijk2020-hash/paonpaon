/**
 * Post-appointment closeout rectangles (CLI-006 / PHASE 7.5 / ADR-066).
 * Structured advisor capture after visits; feeds provenance-aware facts.
 */

import type {
  AppointmentCloseoutId,
  AppointmentId,
  CustomerId,
  MetadataConceptId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";

import {
  type AdvisorRectangleKind,
  type CustomerFact,
  type CustomerFactValidationError,
  validateCustomerFactDraft,
} from "./customer-fact";

export const APPOINTMENT_CLOSEOUT_OUTCOMES = [
  "completed_with_interest",
  "completed_no_purchase",
  "follow_up_scheduled",
  "alteration_started",
  "no_show_confirmed",
] as const;

export type AppointmentCloseoutOutcome =
  (typeof APPOINTMENT_CLOSEOUT_OUTCOMES)[number];

export const CLOSEOUT_RECTANGLE_KINDS = [
  "colour",
  "pattern",
  "fibre",
  "weave",
  "occasion",
  "fit",
] as const satisfies readonly AdvisorRectangleKind[];

export type CloseoutRectangleKind = (typeof CLOSEOUT_RECTANGLE_KINDS)[number];

export interface AppointmentCloseoutSelection {
  readonly conceptId: MetadataConceptId;
  readonly kind: CloseoutRectangleKind;
  readonly label: string;
  readonly polarity: "positive" | "negative";
}

export interface AppointmentCloseout {
  readonly id: AppointmentCloseoutId;
  readonly retailerId: RetailerId;
  readonly appointmentId: AppointmentId;
  readonly customerId: CustomerId;
  readonly authorStaffId: StaffId;
  readonly outcome: AppointmentCloseoutOutcome;
  readonly selections: readonly AppointmentCloseoutSelection[];
  readonly followUpNotes?: string;
  readonly followUpAt?: string;
  readonly createdAt: string;
}

export interface AppointmentCloseoutInput {
  readonly retailerId: RetailerId;
  readonly appointmentId: AppointmentId;
  readonly customerId: CustomerId;
  readonly authorStaffId: StaffId;
  readonly outcome: AppointmentCloseoutOutcome;
  readonly observedAt: string;
  readonly selections: readonly AppointmentCloseoutSelection[];
  readonly followUpNotes?: string;
  readonly followUpAt?: string;
}

export type AppointmentCloseoutValidationError =
  | CustomerFactValidationError
  | "empty_closeout"
  | "invalid_outcome";

export function factsFromAppointmentCloseout(input: AppointmentCloseoutInput): {
  readonly ok: boolean;
  readonly errors: readonly AppointmentCloseoutValidationError[];
  readonly drafts: readonly Omit<
    CustomerFact,
    "id" | "createdAt" | "updatedAt" | "evidence"
  >[];
} {
  if (
    !(APPOINTMENT_CLOSEOUT_OUTCOMES as readonly string[]).includes(
      input.outcome,
    )
  ) {
    return { ok: false, errors: ["invalid_outcome"], drafts: [] };
  }

  if (
    input.selections.length === 0 &&
    !input.followUpNotes?.trim() &&
    input.outcome === "completed_no_purchase"
  ) {
    return { ok: false, errors: ["empty_closeout"], drafts: [] };
  }

  const drafts: Omit<
    CustomerFact,
    "id" | "createdAt" | "updatedAt" | "evidence"
  >[] = [];

  for (const selection of input.selections) {
    const factType =
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
                : selection.kind === "fit"
                  ? "fit_note"
                  : "preference_concept";

    const validation = validateCustomerFactDraft({
      factType,
      provenanceClass: "advisor_observed",
      valueLabel: selection.label,
      confidence: 0.92,
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
      confidence: 0.92,
      sensitivity: "standard",
      visibility: "customer_and_advisor",
      observedAt: input.observedAt,
      authorStaffId: input.authorStaffId,
    });
  }

  if (input.followUpNotes?.trim()) {
    drafts.push({
      retailerId: input.retailerId,
      customerId: input.customerId,
      factType: "other",
      provenanceClass: "advisor_observed",
      valueLabel: input.followUpNotes.trim().slice(0, 500),
      valueText: input.followUpNotes.trim().slice(0, 2000),
      confidence: 0.85,
      sensitivity: "standard",
      visibility: "advisor_only",
      observedAt: input.observedAt,
      authorStaffId: input.authorStaffId,
    });
  }

  return { ok: true, errors: [], drafts };
}
