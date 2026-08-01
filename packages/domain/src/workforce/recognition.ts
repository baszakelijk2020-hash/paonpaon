/**
 * Extra-mile recognition (WFM-104 / PHASE 11.2).
 *
 * This item's non-goal is "no raw-volume leaderboard". That is a real
 * design constraint, not a UI preference: a surface that ranks employees by
 * how many acts they logged rewards logging, not service, and the fastest
 * way to win it is to log trivia. So there is deliberately no ranking, no
 * score and no per-person count exported from this module. What it exposes
 * instead is (a) whether an act is substantive enough to review, and
 * (b) coverage — whether recognition is reaching the whole team or
 * concentrating on a few people, which is a manager's problem to fix rather
 * than an employee's to compete over.
 */

export const RECOGNITION_REVIEW_STATES = [
  "submitted",
  "acknowledged",
  "coached",
  "dismissed",
] as const;

export type RecognitionReviewState = (typeof RECOGNITION_REVIEW_STATES)[number];

export interface RecognitionAct {
  readonly id: string;
  readonly retailerId: string;
  /** The employee the act is about. */
  readonly staffId: string;
  readonly authoredByStaffId: string;
  readonly narrative: string;
  readonly customerId?: string;
  readonly appointmentId?: string;
  readonly orderId?: string;
  readonly occurredOn: string;
  readonly reviewState: RecognitionReviewState;
  readonly reviewedByStaffId?: string;
  readonly reviewedAt?: string;
  readonly coachingNote?: string;
}

export const RECOGNITION_MIN_NARRATIVE_LENGTH = 10;

export type RecognitionRejectionReason =
  | "narrative_too_short"
  | "self_review_not_allowed"
  | "already_reviewed"
  | "coaching_requires_note";

export type RecognitionSubmissionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: RecognitionRejectionReason };

/**
 * A submitted act must actually say something. The 10-character floor is
 * also enforced by a CHECK constraint in the migration — duplicated
 * deliberately so a bad submission fails fast with a readable reason
 * instead of surfacing a raw Postgres constraint violation to an employee.
 */
export function checkRecognitionSubmission(args: {
  readonly narrative: string;
}): RecognitionSubmissionCheck {
  if (args.narrative.trim().length < RECOGNITION_MIN_NARRATIVE_LENGTH) {
    return { ok: false, reason: "narrative_too_short" };
  }
  return { ok: true };
}

/**
 * A manager may not review an act about themselves, and an act may only be
 * reviewed once. Self-review is blocked because the whole value of a
 * recognition is that someone else judged it worth noting — a manager
 * acknowledging their own act converts the surface into self-promotion.
 * (The manager-role requirement itself is enforced by RLS, not here; this
 * covers the case RLS cannot see: a legitimate manager reviewing their own
 * entry.)
 */
export function checkRecognitionReview(args: {
  readonly act: Pick<RecognitionAct, "staffId" | "reviewState">;
  readonly reviewerStaffId: string;
  readonly nextState: Exclude<RecognitionReviewState, "submitted">;
  readonly coachingNote?: string;
}): RecognitionSubmissionCheck {
  if (args.act.reviewState !== "submitted") {
    return { ok: false, reason: "already_reviewed" };
  }
  if (args.act.staffId === args.reviewerStaffId) {
    return { ok: false, reason: "self_review_not_allowed" };
  }
  if (
    args.nextState === "coached" &&
    (args.coachingNote ?? "").trim().length === 0
  ) {
    return { ok: false, reason: "coaching_requires_note" };
  }
  return { ok: true };
}

export interface RecognitionCoverage {
  /** Distinct employees who have at least one reviewed, non-dismissed act. */
  readonly recognizedStaffCount: number;
  readonly totalStaffCount: number;
  /** Employees with no recognition at all in the window — the actionable list. */
  readonly unrecognizedStaffIds: readonly string[];
  readonly awaitingReviewCount: number;
}

/**
 * Coverage, not ranking. Answers "is recognition reaching everyone?" — a
 * question a manager can act on — rather than "who has the most?", which
 * only invites gaming. Note what is NOT returned: no per-person totals, no
 * ordering by count, no top performer. Adding any of those would defeat
 * this item's stated non-goal, so they are absent by construction rather
 * than merely unrendered.
 */
export function summarizeRecognitionCoverage(args: {
  readonly acts: readonly Pick<RecognitionAct, "staffId" | "reviewState">[];
  readonly allStaffIds: readonly string[];
}): RecognitionCoverage {
  const recognized = new Set<string>();
  let awaitingReview = 0;

  for (const act of args.acts) {
    if (act.reviewState === "submitted") {
      awaitingReview += 1;
      continue;
    }
    // A dismissed act is not recognition — counting it would let a manager
    // "cover" someone by dismissing an act about them.
    if (act.reviewState === "dismissed") continue;
    recognized.add(act.staffId);
  }

  const unrecognized = args.allStaffIds.filter((id) => !recognized.has(id));

  return {
    recognizedStaffCount: recognized.size,
    totalStaffCount: args.allStaffIds.length,
    unrecognizedStaffIds: unrecognized,
    awaitingReviewCount: awaitingReview,
  };
}
