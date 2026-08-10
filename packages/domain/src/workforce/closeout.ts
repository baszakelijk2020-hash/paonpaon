/**
 * Shift closeout (WFM-104 / PHASE 11.2).
 *
 * Ten-minute closeout captures: promises made, customer facts learned,
 * opportunities created, problems requiring management, stock/service
 * anomalies, one thing that worked, an extra-mile act, and help/coaching
 * requested. One structured row per staff member per day.
 */

export interface ShiftCloseout {
  readonly id: string;
  readonly retailerId: string;
  readonly staffId: string;
  readonly closeoutDate: string;
  readonly promisesNote: string;
  readonly factsLearnedNote?: string;
  readonly problemsNote?: string;
  readonly anomaliesNote?: string;
  readonly whatWorkedNote: string;
  readonly helpRequestedNote?: string;
  readonly extraMileActId?: string;
  readonly submittedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const CLOSEOUT_MIN_TEXT_LENGTH = 1;
export const CLOSEOUT_MAX_TEXT_LENGTH = 2000;

export type CloseoutRejectionReason =
  | "promises_required"
  | "promises_too_short"
  | "promises_too_long"
  | "what_worked_required"
  | "what_worked_too_short"
  | "what_worked_too_long"
  | "text_too_long";

export type CloseoutSubmissionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: CloseoutRejectionReason };

/**
 * Validate closeout fields. Both promises_note and what_worked_note are
 * required and must be substantive.
 */
export function checkCloseoutSubmission(args: {
  readonly promisesNote: string;
  readonly whatWorkedNote: string;
  readonly factsLearnedNote?: string;
  readonly problemsNote?: string;
  readonly anomaliesNote?: string;
  readonly helpRequestedNote?: string;
}): CloseoutSubmissionCheck {
  const promisesNormalized = args.promisesNote.trim();
  const whatWorkedNormalized = args.whatWorkedNote.trim();

  if (promisesNormalized.length === 0) {
    return { ok: false, reason: "promises_required" };
  }
  if (promisesNormalized.length < CLOSEOUT_MIN_TEXT_LENGTH) {
    return { ok: false, reason: "promises_too_short" };
  }
  if (promisesNormalized.length > CLOSEOUT_MAX_TEXT_LENGTH) {
    return { ok: false, reason: "promises_too_long" };
  }

  if (whatWorkedNormalized.length === 0) {
    return { ok: false, reason: "what_worked_required" };
  }
  if (whatWorkedNormalized.length < CLOSEOUT_MIN_TEXT_LENGTH) {
    return { ok: false, reason: "what_worked_too_short" };
  }
  if (whatWorkedNormalized.length > CLOSEOUT_MAX_TEXT_LENGTH) {
    return { ok: false, reason: "what_worked_too_long" };
  }

  // Check optional fields don't exceed max length
  const optionalFields = [
    args.factsLearnedNote,
    args.problemsNote,
    args.anomaliesNote,
    args.helpRequestedNote,
  ];
  for (const field of optionalFields) {
    if (field && field.trim().length > CLOSEOUT_MAX_TEXT_LENGTH) {
      return { ok: false, reason: "text_too_long" };
    }
  }

  return { ok: true };
}
