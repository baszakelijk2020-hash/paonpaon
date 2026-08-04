/**
 * Measurement and fitting rollout planning (BD-106 / PHASE 18.6).
 *
 * Bulk planning for a programme rollout — distinct from booking one
 * appointment at a time, and distinct from `checkGroupFittingCapacity`
 * (`packages/domain/src/wedding/moonstruck-pack.ts`), which answers a
 * different question ("can N people be fitted before a date at all")
 * than this file does ("which specific day does this specific person go
 * on, and what happens when a day is already full or someone doesn't
 * show"). Both are kept — a rollout's own feasibility check should
 * still reuse `checkGroupFittingCapacity` for the same eight-groomsmen-
 * one-fitter reasoning, never a second copy of that formula.
 */

export type AssignWearerToDayCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "day_at_capacity" };

/** The capacity enforcement itself — a day cannot silently take a
 * (capacity + 1)th person. */
export function checkAssignWearerToDay(args: {
  readonly currentlyAssignedCount: number;
  readonly capacity: number;
}): AssignWearerToDayCheck {
  if (args.currentlyAssignedCount >= args.capacity) {
    return { ok: false, reason: "day_at_capacity" };
  }
  return { ok: true };
}

export interface RolloutDayCapacity {
  readonly rolloutDayId: string;
  readonly fittingDate: string;
  readonly currentlyAssignedCount: number;
  readonly capacity: number;
}

export type PlanNoShowReslotResult =
  | { readonly ok: true; readonly rolloutDayId: string }
  | { readonly ok: false; readonly reason: "no_capacity_available" };

/**
 * A no-show must never silently drop the employee from the rollout —
 * that is this item's own stated acceptance criterion. Picks the
 * earliest still-open day with spare capacity; refuses honestly (rather
 * than overbooking) when none exists, so a planner sees a real gap to
 * solve instead of a wearer quietly disappearing from the plan.
 */
export function planNoShowReslot(args: {
  readonly candidateDays: readonly RolloutDayCapacity[];
}): PlanNoShowReslotResult {
  const sorted = [...args.candidateDays].sort((a, b) =>
    a.fittingDate.localeCompare(b.fittingDate),
  );
  const openDay = sorted.find(
    (day) => day.currentlyAssignedCount < day.capacity,
  );
  if (!openDay) return { ok: false, reason: "no_capacity_available" };
  return { ok: true, rolloutDayId: openDay.rolloutDayId };
}
