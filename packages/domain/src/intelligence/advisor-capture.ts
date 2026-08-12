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

import type { ClientelingChannel } from "./clienteling-opportunity";
import { CUSTOMER_FACT_TYPES, type CustomerFactType } from "./customer-fact";

export const CAPTURE_SOURCES = [
  "text",
  "voice",
  "photo",
  "conversation_message",
] as const;
export type CaptureSource = (typeof CAPTURE_SOURCES)[number];

export const CAPTURE_BUNDLE_KINDS = [
  "self_portrait_fact",
  "follow_up",
  "task_note",
  "appointment",
] as const;
export type CaptureBundleKind = (typeof CAPTURE_BUNDLE_KINDS)[number];

/** Mirrors packages/domain/src/appointments/appointment.ts's AppointmentType
 * union -- kept local rather than imported to avoid a cross-subdomain
 * dependency from intelligence/ into appointments/ for one literal check. */
export const CAPTURE_APPOINTMENT_TYPES = [
  "styling_consultation",
  "fitting",
  "alteration_fitting",
  "personal_shopping",
  "event",
] as const;
export type CaptureAppointmentType = (typeof CAPTURE_APPOINTMENT_TYPES)[number];

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
}

export interface TaskNotePayload {
  readonly note: string;
}

export interface AppointmentPayload {
  readonly appointmentType: CaptureAppointmentType;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly notes?: string;
}

export type CaptureBundlePayload =
  | SelfPortraitFactPayload
  | FollowUpPayload
  | TaskNotePayload
  | AppointmentPayload;

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
        | "appointment_time_range_required"
        | "appointment_time_range_invalid";
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
  } else {
    const payload = proposal.payload as AppointmentPayload;
    if (!CAPTURE_APPOINTMENT_TYPES.includes(payload.appointmentType)) {
      return { ok: false, reason: "appointment_type_required" };
    }
    if (!payload.startsAt || !payload.endsAt) {
      return { ok: false, reason: "appointment_time_range_required" };
    }
    if (
      new Date(payload.startsAt).getTime() >= new Date(payload.endsAt).getTime()
    ) {
      return { ok: false, reason: "appointment_time_range_invalid" };
    }
  }

  return { ok: true };
}
