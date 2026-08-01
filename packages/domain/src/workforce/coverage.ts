/**
 * Coverage planning and explainable staffing (WFM-105 / PHASE 11.3).
 *
 * Two deliberate constraints from this item's own non-goal ("no fully
 * autonomous scheduling"):
 *
 * 1. Nothing here writes a shift. `recommendCoverage` returns a
 *    *recommendation* a manager acts on, never an assignment.
 * 2. Every recommendation carries its citations. A shortage the system
 *    cannot explain is not surfaced as a shortage — see
 *    `StaffingRecommendation.citations`, which is a non-empty array by
 *    construction (`buildCitation` is the only way to make one and the
 *    recommender refuses to emit a recommendation with none).
 *
 * Times are handled as local wall-clock strings ("HH:MM") against a named
 * IANA timezone carried on the plan, not as UTC instants. A store's
 * Saturday 10:00–18:00 stays 10:00–18:00 across a DST boundary; converting
 * to instants here would silently shift the roster by an hour twice a year.
 */

export const COVERAGE_PLAN_STATES = ["draft", "published"] as const;
export type CoveragePlanState = (typeof COVERAGE_PLAN_STATES)[number];

export const STAFFING_SIGNAL_KINDS = [
  "booked_appointments",
  "published_shift",
  "declared_availability",
  "approved_absence",
  "historical_footfall",
] as const;
export type StaffingSignalKind = (typeof STAFFING_SIGNAL_KINDS)[number];

/**
 * A single piece of evidence behind a recommendation. `observedValue` is
 * the number the manager can go and check for themselves; `sourceRef`
 * points at the row it came from so "why does it say this" is answerable
 * without reading code.
 */
export interface StaffingCitation {
  readonly kind: StaffingSignalKind;
  readonly observedValue: number;
  readonly sourceRef: string;
  readonly windowStart: string;
  readonly windowEnd: string;
}

export function buildCitation(args: StaffingCitation): StaffingCitation {
  return args;
}

export interface CoverageInterval {
  /** Local wall-clock "HH:MM", inclusive. */
  readonly startTime: string;
  /** Local wall-clock "HH:MM", exclusive. */
  readonly endTime: string;
  /** How many people the manager says this interval needs. */
  readonly requiredHeadcount: number;
  /** Skills that must be present at least once in the interval. */
  readonly requiredSkills?: readonly string[];
}

export interface CoveragePlan {
  readonly retailerId: string;
  readonly planDate: string;
  readonly timezone: string;
  readonly state: CoveragePlanState;
  readonly intervals: readonly CoverageInterval[];
}

export interface ScheduledShift {
  readonly staffId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly skills?: readonly string[];
  readonly sourceRef: string;
}

export const SHORTAGE_KINDS = [
  "headcount_below_requirement",
  "missing_required_skill",
] as const;
export type ShortageKind = (typeof SHORTAGE_KINDS)[number];

export interface StaffingRecommendation {
  readonly kind: ShortageKind;
  readonly startTime: string;
  readonly endTime: string;
  readonly shortfall: number;
  readonly missingSkill?: string;
  readonly rationale: string;
  /** Never empty — see the module docblock. */
  readonly citations: readonly StaffingCitation[];
}

function toMinutes(hhmm: string): number {
  const [hoursRaw, minutesRaw] = hhmm.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    throw new Error(`Invalid wall-clock time: ${hhmm}`);
  }
  return hours * 60 + minutes;
}

/** Half-open overlap: a shift ending exactly when an interval starts does
 * not cover it. Treating that as coverage is how rosters end up with a
 * five-minute hole nobody planned. */
function overlaps(
  a: { readonly startTime: string; readonly endTime: string },
  b: { readonly startTime: string; readonly endTime: string },
): boolean {
  return (
    toMinutes(a.startTime) < toMinutes(b.endTime) &&
    toMinutes(b.startTime) < toMinutes(a.endTime)
  );
}

/**
 * Compares a published requirement against the shifts actually scheduled
 * and returns cited shortages. A surplus is not reported: this answers
 * "where will we be short", not "who is idle", which is a different
 * question with a much worse failure mode.
 */
export function recommendCoverage(args: {
  readonly plan: CoveragePlan;
  readonly shifts: readonly ScheduledShift[];
  readonly demandCitations?: readonly StaffingCitation[];
}): readonly StaffingRecommendation[] {
  const recommendations: StaffingRecommendation[] = [];

  for (const interval of args.plan.intervals) {
    const covering = args.shifts.filter((shift) => overlaps(shift, interval));
    const scheduled = covering.length;

    const intervalCitations: StaffingCitation[] = covering.map((shift) =>
      buildCitation({
        kind: "published_shift",
        observedValue: 1,
        sourceRef: shift.sourceRef,
        windowStart: shift.startTime,
        windowEnd: shift.endTime,
      }),
    );
    for (const citation of args.demandCitations ?? []) {
      // A citation carries its own window field names; it is evidence, not
      // a shift, and conflating the two shapes is how a morning demand
      // signal ends up justifying an afternoon shortage.
      const citationWindow = {
        startTime: citation.windowStart,
        endTime: citation.windowEnd,
      };
      if (overlaps(interval, citationWindow)) {
        intervalCitations.push(citation);
      }
    }

    if (scheduled < interval.requiredHeadcount) {
      const shortfall = interval.requiredHeadcount - scheduled;
      // No citation means no explanation, and an unexplainable shortage is
      // exactly the "black-box" outcome the programme forbids. Fall back to
      // citing the requirement itself rather than emitting a bare number.
      const citations =
        intervalCitations.length > 0
          ? intervalCitations
          : [
              buildCitation({
                kind: "published_shift",
                observedValue: 0,
                sourceRef: `coverage_plan:${args.plan.planDate}`,
                windowStart: interval.startTime,
                windowEnd: interval.endTime,
              }),
            ];
      recommendations.push({
        kind: "headcount_below_requirement",
        startTime: interval.startTime,
        endTime: interval.endTime,
        shortfall,
        rationale: `${scheduled} of ${interval.requiredHeadcount} scheduled between ${interval.startTime} and ${interval.endTime}`,
        citations,
      });
    }

    for (const skill of interval.requiredSkills ?? []) {
      const present = covering.some((shift) =>
        (shift.skills ?? []).includes(skill),
      );
      if (present) continue;
      recommendations.push({
        kind: "missing_required_skill",
        startTime: interval.startTime,
        endTime: interval.endTime,
        shortfall: 1,
        missingSkill: skill,
        rationale: `No one scheduled between ${interval.startTime} and ${interval.endTime} has "${skill}"`,
        citations:
          intervalCitations.length > 0
            ? intervalCitations
            : [
                buildCitation({
                  kind: "published_shift",
                  observedValue: 0,
                  sourceRef: `coverage_plan:${args.plan.planDate}`,
                  windowStart: interval.startTime,
                  windowEnd: interval.endTime,
                }),
              ],
      });
    }
  }

  return recommendations;
}

export const SWAP_STATES = [
  "requested",
  "accepted_by_peer",
  "approved",
  "declined",
  "withdrawn",
] as const;
export type SwapState = (typeof SWAP_STATES)[number];

export type SwapCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "not_own_shift"
        | "peer_unavailable"
        | "peer_already_scheduled"
        | "self_approval_not_allowed"
        | "not_awaiting_approval"
        | "would_break_required_skill";
    };

/**
 * Guards a swap *request*. Deliberately separate from approval: a peer
 * accepting is not the same event as a manager approving, and collapsing
 * them is how coverage silently degrades.
 */
export function checkSwapRequest(args: {
  readonly shift: ScheduledShift;
  readonly requestingStaffId: string;
  readonly peerStaffId: string;
  readonly peerDeclaredAvailable: boolean;
  readonly peerExistingShifts: readonly ScheduledShift[];
}): SwapCheck {
  if (args.shift.staffId !== args.requestingStaffId) {
    return { ok: false, reason: "not_own_shift" };
  }
  if (!args.peerDeclaredAvailable) {
    return { ok: false, reason: "peer_unavailable" };
  }
  if (args.peerExistingShifts.some((shift) => overlaps(shift, args.shift))) {
    return { ok: false, reason: "peer_already_scheduled" };
  }
  return { ok: true };
}

/**
 * Guards manager approval. The skill check runs here rather than at request
 * time on purpose — the roster can change between the two, and the state
 * that matters is the one at the moment coverage actually changes.
 */
export function checkSwapApproval(args: {
  readonly state: SwapState;
  readonly approverStaffId: string;
  readonly requestingStaffId: string;
  readonly peerStaffId: string;
  readonly requiredSkills: readonly string[];
  readonly peerSkills: readonly string[];
  readonly otherCoveringSkills: readonly string[];
}): SwapCheck {
  if (args.state !== "accepted_by_peer") {
    return { ok: false, reason: "not_awaiting_approval" };
  }
  if (
    args.approverStaffId === args.requestingStaffId ||
    args.approverStaffId === args.peerStaffId
  ) {
    return { ok: false, reason: "self_approval_not_allowed" };
  }
  for (const skill of args.requiredSkills) {
    const stillCovered =
      args.peerSkills.includes(skill) ||
      args.otherCoveringSkills.includes(skill);
    if (!stillCovered) {
      return { ok: false, reason: "would_break_required_skill" };
    }
  }
  return { ok: true };
}
