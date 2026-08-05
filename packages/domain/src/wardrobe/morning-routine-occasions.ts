/**
 * MorningRoutine's "Coming up" card (PHASE 17.10 / ADV-110, vision spec
 * §14) — the ahead-of-time half of the three-card expansion, surfaced
 * from Self-Portrait's existing dated facts. Reuses 10.4's
 * `evaluateRelationshipDateWindow`/`nextYearlyOccurrence` recurrence math
 * rather than a second feature-local copy of it — the exact mistake
 * 10.4's own history already made once and corrected.
 */

import { evaluateRelationshipDateWindow } from "../campaign/relationship-calendar";
import type { CustomerFactType } from "../intelligence/customer-fact";

export const UPCOMING_OCCASION_FACT_TYPES = [
  "anniversary",
  "wedding_date",
  "occasion",
  "travel_window",
] as const satisfies readonly CustomerFactType[];

export type UpcomingOccasionFactType =
  (typeof UPCOMING_OCCASION_FACT_TYPES)[number];

export const UPCOMING_OCCASION_FACT_TYPE_LABELS: Record<
  UpcomingOccasionFactType,
  string
> = {
  anniversary: "Anniversary",
  wedding_date: "Wedding date",
  occasion: "Occasion",
  travel_window: "Travel",
};

export interface UpcomingOccasionFactInput {
  readonly factId: string;
  readonly factType: CustomerFactType;
  /** Expected to be an ISO `YYYY-MM-DD` date for these fact types — a
   * fact whose value isn't a clean ISO date is silently skipped, never
   * guessed at. */
  readonly valueLabel: string;
  readonly valueText?: string;
}

export interface UpcomingOccasion {
  readonly factId: string;
  readonly factType: UpcomingOccasionFactType;
  readonly label: string;
  readonly note?: string;
  readonly nextOccurrenceIso: string;
  readonly daysUntil: number;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isUpcomingOccasionFactType(
  factType: CustomerFactType,
): factType is UpcomingOccasionFactType {
  return (UPCOMING_OCCASION_FACT_TYPES as readonly string[]).includes(factType);
}

/**
 * Surfaces every dated fact due within `leadDays`, nearest first — far
 * enough ahead to act on (book an appointment, order in time for
 * alterations), never same-day only.
 */
export function selectUpcomingOccasions(args: {
  readonly facts: readonly UpcomingOccasionFactInput[];
  readonly todayIso: string;
  readonly leadDays: number;
}): readonly UpcomingOccasion[] {
  const occasions: UpcomingOccasion[] = [];
  for (const fact of args.facts) {
    if (!isUpcomingOccasionFactType(fact.factType)) continue;
    if (!ISO_DATE_PATTERN.test(fact.valueLabel)) continue;
    const window = evaluateRelationshipDateWindow({
      relationshipDateIso: fact.valueLabel,
      todayIso: args.todayIso,
      leadDays: args.leadDays,
    });
    if (!window.inWindow) continue;
    occasions.push({
      factId: fact.factId,
      factType: fact.factType,
      label: UPCOMING_OCCASION_FACT_TYPE_LABELS[fact.factType],
      ...(fact.valueText ? { note: fact.valueText } : {}),
      nextOccurrenceIso: window.nextOccurrenceIso,
      daysUntil: window.daysUntil,
    });
  }
  return occasions.sort((a, b) => a.daysUntil - b.daysUntil);
}
