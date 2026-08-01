/**
 * Ceremony versions, contextual prompts, and the observation-to-coaching
 * loop (WFM-106 / PHASE 11.3).
 *
 * The loop is deliberately a state machine rather than free-form notes: an
 * observation that never produces a plan, and a plan that never records an
 * outcome, are the two ways coaching quietly becomes surveillance. Both
 * are refused here.
 *
 * A ceremony is versioned and immutable once published, for the same
 * reason a campaign library version is: a coaching observation cites the
 * ceremony version it was made against, and editing that version in place
 * would restate history.
 */

export interface CeremonyStep {
  readonly key: string;
  readonly title: string;
  /** Free-text guidance shown to the advisor. */
  readonly guidance: string;
  /** Optional trigger — the step only surfaces when the context matches. */
  readonly appliesWhen?: CeremonyContextMatch;
}

export interface CeremonyContextMatch {
  readonly appointmentKind?: string;
  readonly customerIsFirstVisit?: boolean;
  readonly hasOpenAlteration?: boolean;
}

export interface CeremonyVersion {
  readonly ceremonyKey: string;
  readonly version: number;
  readonly published: boolean;
  readonly steps: readonly CeremonyStep[];
}

export interface CeremonyContext {
  readonly appointmentKind?: string;
  readonly customerIsFirstVisit?: boolean;
  readonly hasOpenAlteration?: boolean;
}

/**
 * Selects the steps that actually apply right now. A step with no
 * `appliesWhen` always applies; a step with one applies only when every
 * declared condition matches. Undeclared conditions are ignored rather
 * than treated as `false`, so adding a new context field later cannot
 * silently switch off existing steps.
 */
export function selectCeremonyPrompts(args: {
  readonly version: CeremonyVersion;
  readonly context: CeremonyContext;
}): readonly CeremonyStep[] {
  if (!args.version.published) return [];
  return args.version.steps.filter((step) => {
    const match = step.appliesWhen;
    if (!match) return true;
    if (
      match.appointmentKind !== undefined &&
      match.appointmentKind !== args.context.appointmentKind
    ) {
      return false;
    }
    if (
      match.customerIsFirstVisit !== undefined &&
      match.customerIsFirstVisit !== args.context.customerIsFirstVisit
    ) {
      return false;
    }
    if (
      match.hasOpenAlteration !== undefined &&
      match.hasOpenAlteration !== args.context.hasOpenAlteration
    ) {
      return false;
    }
    return true;
  });
}

export type CeremonyPublishCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "already_published"
        | "no_steps"
        | "duplicate_step_key"
        | "version_not_incremented";
    };

/**
 * A published ceremony version can never be edited or re-published — the
 * next change is a new version. This is what makes an observation's
 * `ceremonyVersion` citation meaningful a year later.
 */
export function checkCeremonyPublish(args: {
  readonly candidate: CeremonyVersion;
  readonly latestPublishedVersion?: number;
}): CeremonyPublishCheck {
  if (args.candidate.published)
    return { ok: false, reason: "already_published" };
  if (args.candidate.steps.length === 0)
    return { ok: false, reason: "no_steps" };
  const keys = args.candidate.steps.map((step) => step.key);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, reason: "duplicate_step_key" };
  }
  const latest = args.latestPublishedVersion ?? 0;
  if (args.candidate.version <= latest) {
    return { ok: false, reason: "version_not_incremented" };
  }
  return { ok: true };
}

export const RUBRIC_SCALE = [1, 2, 3, 4] as const;
export type RubricScore = (typeof RUBRIC_SCALE)[number];

export interface RubricCriterionScore {
  readonly criterionKey: string;
  readonly score: RubricScore;
  /** What was actually seen. A score with no evidence is refused. */
  readonly evidence: string;
}

export const COACHING_STATES = [
  "observed",
  "discussed",
  "plan_agreed",
  "outcome_recorded",
] as const;
export type CoachingState = (typeof COACHING_STATES)[number];

export interface Observation {
  readonly observedStaffId: string;
  readonly observerStaffId: string;
  readonly ceremonyKey: string;
  readonly ceremonyVersion: number;
  readonly scores: readonly RubricCriterionScore[];
  readonly state: CoachingState;
}

export type CoachingCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "self_observation_not_allowed"
        | "no_criteria_scored"
        | "score_without_evidence"
        | "duplicate_criterion"
        | "out_of_order_transition"
        | "plan_requires_agreed_action"
        | "outcome_requires_plan";
    };

const EVIDENCE_MIN_LENGTH = 10;

/**
 * Guards recording an observation. Self-observation is refused for the
 * same reason self-review is in 11.2's recognition: RLS can prove the
 * caller is a manager, not that the subject is someone else.
 */
export function checkObservation(args: {
  readonly observedStaffId: string;
  readonly observerStaffId: string;
  readonly scores: readonly RubricCriterionScore[];
}): CoachingCheck {
  if (args.observedStaffId === args.observerStaffId) {
    return { ok: false, reason: "self_observation_not_allowed" };
  }
  if (args.scores.length === 0) {
    return { ok: false, reason: "no_criteria_scored" };
  }
  const keys = args.scores.map((entry) => entry.criterionKey);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, reason: "duplicate_criterion" };
  }
  for (const entry of args.scores) {
    if (entry.evidence.trim().length < EVIDENCE_MIN_LENGTH) {
      return { ok: false, reason: "score_without_evidence" };
    }
  }
  return { ok: true };
}

const NEXT_STATE: Record<CoachingState, CoachingState | undefined> = {
  observed: "discussed",
  discussed: "plan_agreed",
  plan_agreed: "outcome_recorded",
  outcome_recorded: undefined,
};

/**
 * The loop only advances one step at a time. Jumping straight from
 * `observed` to `outcome_recorded` would let a manager close a coaching
 * record the employee was never told about, which is the failure this
 * item's acceptance criterion ("completes observation-to-coaching loop")
 * exists to prevent.
 */
export function checkCoachingTransition(args: {
  readonly current: CoachingState;
  readonly next: CoachingState;
  readonly agreedAction?: string;
  readonly outcomeNote?: string;
}): CoachingCheck {
  if (NEXT_STATE[args.current] !== args.next) {
    return { ok: false, reason: "out_of_order_transition" };
  }
  if (
    args.next === "plan_agreed" &&
    (args.agreedAction ?? "").trim().length === 0
  ) {
    return { ok: false, reason: "plan_requires_agreed_action" };
  }
  if (
    args.next === "outcome_recorded" &&
    (args.outcomeNote ?? "").trim().length === 0
  ) {
    return { ok: false, reason: "outcome_requires_plan" };
  }
  return { ok: true };
}

export interface CoachingLoopSummary {
  readonly openObservationCount: number;
  readonly awaitingPlanCount: number;
  readonly closedLoopCount: number;
  /** Staff with an observation older than the staleness window and no
   * agreed plan. Named so a manager can finish what they started. */
  readonly stalledStaffIds: readonly string[];
}

/**
 * Reports whether loops are being *closed*, not who scored what. As with
 * recognition, there is no per-person score aggregate here by design — an
 * average rubric score per advisor is a performance ranking wearing a
 * coaching costume.
 */
export function summarizeCoachingLoop(args: {
  readonly observations: readonly {
    readonly observedStaffId: string;
    readonly state: CoachingState;
    readonly observedOn: string;
  }[];
  readonly asOf: string;
  readonly stalenessDays?: number;
}): CoachingLoopSummary {
  const stalenessDays = args.stalenessDays ?? 14;
  const cutoffMs = Date.parse(args.asOf) - stalenessDays * 24 * 60 * 60 * 1000;
  const stalled = new Set<string>();
  let open = 0;
  let awaitingPlan = 0;
  let closed = 0;

  for (const observation of args.observations) {
    if (observation.state === "outcome_recorded") {
      closed += 1;
      continue;
    }
    open += 1;
    if (observation.state === "observed" || observation.state === "discussed") {
      awaitingPlan += 1;
      if (Date.parse(observation.observedOn) < cutoffMs) {
        stalled.add(observation.observedStaffId);
      }
    }
  }

  return {
    openObservationCount: open,
    awaitingPlanCount: awaitingPlan,
    closedLoopCount: closed,
    stalledStaffIds: [...stalled].sort(),
  };
}
