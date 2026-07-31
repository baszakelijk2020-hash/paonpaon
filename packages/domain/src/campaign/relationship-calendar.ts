/**
 * Relationship-calendar campaign eligibility (CMP-107 / REL-20 / PHASE 10.4).
 *
 * Reuses Stage 7's existing customer_facts anniversary/wedding_date fact
 * types (already the "relationship event/fact foundation" 10.4 depends on —
 * no new fact schema needed) rather than inventing a parallel date store.
 * This module adds only the missing piece: deciding whether TODAY falls
 * inside a campaign's lead-time window around a customer's own recurring
 * date, timezone-aware and correct across a year boundary (a
 * December-dated anniversary must still fire in early January).
 */

import type { CampaignLibrarySnapshot } from "./campaign-library";

export interface RelationshipDateWindowInput {
  /** ISO date or datetime — only month/day are used; year is ignored
   * (the whole point is annual recurrence, not one specific year). */
  readonly relationshipDateIso: string;
  /** The date to evaluate eligibility as of, in the retailer's own timezone
   * (already resolved to a wall-clock date string by the caller — this
   * function does no timezone math itself, matching campaigns.timezone
   * being a plain IANA string resolved by whoever calls it). */
  readonly todayIso: string;
  /** Days before the date the window opens. */
  readonly leadDays: number;
  /** Days after the date the window stays open (0 = closes on the day itself). */
  readonly trailingDays?: number;
}

export type RelationshipDateWindowResult =
  | {
      readonly inWindow: true;
      readonly daysUntil: number;
      readonly nextOccurrenceIso: string;
    }
  | { readonly inWindow: false; readonly reason: "outside_window" };

function daysBetween(fromIso: string, toIso: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / msPerDay);
}

/**
 * Finds the nearest occurrence of relationshipDate's month/day at or after
 * today, rolling into next year if this year's occurrence has already
 * passed — this is what makes a December 20 anniversary still correctly
 * evaluate as "10 days away" when today is December 10, and correctly
 * evaluate as "356 days away" (not "-355") the day after it passes.
 */
function nextOccurrence(relationshipDateIso: string, todayIso: string): Date {
  const relationship = new Date(relationshipDateIso);
  const today = new Date(todayIso);
  const candidate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      relationship.getUTCMonth(),
      relationship.getUTCDate(),
    ),
  );
  const todayMidnight = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (candidate.getTime() < todayMidnight.getTime()) {
    candidate.setUTCFullYear(candidate.getUTCFullYear() + 1);
  }
  return candidate;
}

/**
 * Decides whether a relationship-calendar campaign should be eligible today
 * for one customer's recurring date. Pure and timezone-agnostic by design —
 * the caller resolves "today" in the retailer's own timezone before calling,
 * matching how campaigns.timezone already works for scheduled sends.
 */
export function evaluateRelationshipDateWindow(
  input: RelationshipDateWindowInput,
): RelationshipDateWindowResult {
  const trailingDays = input.trailingDays ?? 0;
  const occurrence = nextOccurrence(input.relationshipDateIso, input.todayIso);
  const occurrenceIso = occurrence.toISOString();
  const daysUntil = daysBetween(input.todayIso, occurrenceIso);

  // A date within the trailing window has technically "just passed" (0 or
  // small positive daysUntil would already cover the day itself and future
  // days; the trailing case needs the PREVIOUS occurrence, one year back).
  if (daysUntil <= input.leadDays) {
    return {
      inWindow: true,
      daysUntil,
      nextOccurrenceIso: occurrenceIso,
    };
  }

  if (trailingDays > 0) {
    const previousOccurrence = new Date(occurrence);
    previousOccurrence.setUTCFullYear(occurrence.getUTCFullYear() - 1);
    const daysSincePrevious = daysBetween(
      previousOccurrence.toISOString(),
      input.todayIso,
    );
    if (daysSincePrevious >= 0 && daysSincePrevious <= trailingDays) {
      return {
        inWindow: true,
        daysUntil: -daysSincePrevious,
        nextOccurrenceIso: previousOccurrence.toISOString(),
      };
    }
  }

  return { inWindow: false, reason: "outside_window" };
}

/**
 * One of the nine named relationship-calendar packages 10.4 lists (Valentine,
 * Mother's/Father's Day, coming-of-age, Race Sunday, annual event, client
 * event, dating/single-again, referral, anniversary) — built first because
 * it needs no new fact type (customer_facts already has "anniversary") and
 * no sensitive-context human-rehearsal gate the others may need. The other
 * eight are deliberately NOT stubbed here: PHASE.md's per-slice completion
 * rule treats an unimplemented library entry as vapourware, not progress, so
 * only what actually works is declared.
 */
export const ANNIVERSARY_MOMENT_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "anniversary-moment-v1",
  kind: "private_offer",
  title: "Anniversary Moment",
  summary:
    "A private note and offer timed to the customer's own anniversary date, not a generic calendar blast.",
  prerequisites: [
    "personalization_consent",
    "anniversary_fact",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out once the window opens — this is about being remembered, not a scripted discount push.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "anniversary_date_window",
  },
};
