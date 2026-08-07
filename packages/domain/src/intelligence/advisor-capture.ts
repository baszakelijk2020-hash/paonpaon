/**
 * Advisor capture: a typed/voiced/photographed note, turned by an AI pass
 * into confirmable action bundles against the Self-Portrait
 * (`customer_facts`) and staff follow-ups (`clienteling_opportunities`).
 *
 * The non-goal is a black-box AI. Every bundle is a *proposal* — nothing
 * writes to a canonical table until an advisor confirms or edits it — and
 * `checkCaptureBundleProposal` refuses any bundle whose cited
 * `sourceExcerpt` is not an actual substring of the note it claims to come
 * from. An AI restating its own conclusion as its own proof is exactly the
 * failure mode a "cited" system exists to catch, not merely to describe.
 */

import type { AppointmentType } from "../appointments/appointment";
import { APPOINTMENT_TYPES } from "../appointments/appointment.schema";

import type { ClientelingChannel } from "./clienteling-opportunity";
import { CUSTOMER_FACT_TYPES, type CustomerFactType } from "./customer-fact";

export const CAPTURE_SOURCES = ["text", "voice", "photo"] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

export const CAPTURE_BUNDLE_KINDS = [
  "self_portrait_fact",
  "follow_up",
  "task_note",
  "appointment_proposal",
  "unresolved",
] as const;
export type CaptureBundleKind = (typeof CAPTURE_BUNDLE_KINDS)[number];

export const FOLLOW_UP_COMMITMENT_KINDS = [
  "task",
  "reminder",
  "deliverable",
] as const;
export type FollowUpCommitmentKind =
  (typeof FOLLOW_UP_COMMITMENT_KINDS)[number];

export const CAPTURE_BUNDLE_STATUSES = [
  "proposed",
  "confirmed",
  "dismissed",
] as const;
export type CaptureBundleStatus = (typeof CAPTURE_BUNDLE_STATUSES)[number];

export interface SelfPortraitFactPayload {
  readonly factType: CustomerFactType;
  readonly valueLabel: string;
}

export interface FollowUpPayload {
  readonly whyNow: string;
  readonly suggestedAction: string;
  readonly dueAt?: string;
  readonly channel?: ClientelingChannel;
  /** Distinguishes an internal action (task), a time-triggered ping
   * (reminder) and something promised to the customer (deliverable) —
   * all three route through the same `ClientelingOpportunity`, PAON's
   * one actionable-follow-up primitive, but must stay visibly distinct
   * in review rather than flattening into one generic "task". */
  readonly commitmentKind?: FollowUpCommitmentKind;
}

export interface TaskNotePayload {
  readonly note: string;
}

/** A proposed appointment — the highest-impact bundle kind, since
 * confirming it writes a real `appointments` row (status `requested`).
 * `startsAt` must already be a resolved, concrete ISO date-time: an
 * extractor that cannot resolve "next Tuesday" to a real date must emit
 * an `unresolved` bundle instead, never guess one here. */
export interface AppointmentProposalPayload {
  readonly appointmentType: AppointmentType;
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly reason: string;
}

/** Something the note referenced that PAON cannot safely allocate on
 * its own — an ambiguous date, an unmatched product reference, a
 * conflict with existing data. Never has a write target: it exists so
 * uncertain speech surfaces for a human decision instead of silently
 * becoming (or silently failing to become) a record. */
export interface UnresolvedPayload {
  readonly question: string;
}

export type CaptureBundlePayload =
  | SelfPortraitFactPayload
  | FollowUpPayload
  | TaskNotePayload
  | AppointmentProposalPayload
  | UnresolvedPayload;

export interface CaptureBundleProposal {
  readonly kind: CaptureBundleKind;
  readonly summary: string;
  /** Must be an actual substring of the note it was drawn from — this is
   * the evidence, not a description of evidence. */
  readonly sourceExcerpt: string;
  readonly confidence: number;
  readonly payload: CaptureBundlePayload;
}

export type CaptureBundleCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "summary_required"
        | "source_excerpt_required"
        | "source_excerpt_not_in_note"
        | "confidence_out_of_range"
        | "self_portrait_fact_type_required"
        | "self_portrait_value_required"
        | "follow_up_why_now_required"
        | "follow_up_suggested_action_required"
        | "task_note_required"
        | "appointment_type_required"
        | "appointment_starts_at_invalid"
        | "appointment_duration_invalid"
        | "appointment_reason_required"
        | "unresolved_question_required";
    };

/**
 * The gate every AI-proposed bundle passes before it is even shown to an
 * advisor for review, let alone written anywhere. Refusing here rather
 * than trusting the model's own output is the same reasoning
 * `buildRecommendation` (PHASE 14.2) already applies to cited
 * recommendations.
 */
export function checkCaptureBundleProposal(args: {
  readonly rawText: string;
  readonly proposal: CaptureBundleProposal;
}): CaptureBundleCheck {
  const { proposal, rawText } = args;

  if (proposal.summary.trim().length === 0) {
    return { ok: false, reason: "summary_required" };
  }
  if (proposal.sourceExcerpt.trim().length === 0) {
    return { ok: false, reason: "source_excerpt_required" };
  }
  if (
    !rawText.toLowerCase().includes(proposal.sourceExcerpt.trim().toLowerCase())
  ) {
    return { ok: false, reason: "source_excerpt_not_in_note" };
  }
  if (
    !Number.isFinite(proposal.confidence) ||
    proposal.confidence < 0 ||
    proposal.confidence > 1
  ) {
    return { ok: false, reason: "confidence_out_of_range" };
  }

  if (proposal.kind === "self_portrait_fact") {
    const payload = proposal.payload as SelfPortraitFactPayload;
    if (!CUSTOMER_FACT_TYPES.includes(payload.factType)) {
      return { ok: false, reason: "self_portrait_fact_type_required" };
    }
    if (!payload.valueLabel || payload.valueLabel.trim().length === 0) {
      return { ok: false, reason: "self_portrait_value_required" };
    }
  } else if (proposal.kind === "follow_up") {
    const payload = proposal.payload as FollowUpPayload;
    if (!payload.whyNow || payload.whyNow.trim().length === 0) {
      return { ok: false, reason: "follow_up_why_now_required" };
    }
    if (
      !payload.suggestedAction ||
      payload.suggestedAction.trim().length === 0
    ) {
      return { ok: false, reason: "follow_up_suggested_action_required" };
    }
  } else if (proposal.kind === "task_note") {
    const payload = proposal.payload as TaskNotePayload;
    if (!payload.note || payload.note.trim().length === 0) {
      return { ok: false, reason: "task_note_required" };
    }
  } else if (proposal.kind === "appointment_proposal") {
    const payload = proposal.payload as AppointmentProposalPayload;
    if (!APPOINTMENT_TYPES.includes(payload.appointmentType)) {
      return { ok: false, reason: "appointment_type_required" };
    }
    if (!payload.startsAt || Number.isNaN(Date.parse(payload.startsAt))) {
      return { ok: false, reason: "appointment_starts_at_invalid" };
    }
    if (
      !Number.isFinite(payload.durationMinutes) ||
      payload.durationMinutes <= 0 ||
      payload.durationMinutes > 480
    ) {
      return { ok: false, reason: "appointment_duration_invalid" };
    }
    if (!payload.reason || payload.reason.trim().length === 0) {
      return { ok: false, reason: "appointment_reason_required" };
    }
  } else {
    const payload = proposal.payload as UnresolvedPayload;
    if (!payload.question || payload.question.trim().length === 0) {
      return { ok: false, reason: "unresolved_question_required" };
    }
  }

  return { ok: true };
}
