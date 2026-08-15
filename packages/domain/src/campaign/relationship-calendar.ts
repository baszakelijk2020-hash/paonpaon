/**
 * Relationship-calendar campaign eligibility (CMP-107 / REL-20 / PHASE 10.4).
 *
 * Reuses Stage 7's existing customer_facts anniversary/wedding_date fact
 * types (already the "relationship event/fact foundation" 10.4 depends on —
 * no new fact schema needed) rather than inventing a parallel date store.
 * This module adds the missing piece: deciding whether TODAY falls inside a
 * campaign's lead-time window around a customer's own recurring date. The
 * recurrence math itself reuses `nextYearlyOccurrence` from
 * `appointments/customer-moment.ts` — found only after first writing a
 * near-duplicate of it here, which is exactly the "second feature-local
 * truth" AGENTS.md warns against; corrected once found rather than left in
 * place with the shared function undiscovered by the next reader too.
 *
 * `evaluateRelationshipDateWindow` itself does not care whether
 * `relationshipDateIso` came from a customer's own recurring fact or a
 * fixed calendar date shared by every customer (e.g. Valentine's Day) — it
 * only ever looks at month/day recurrence — so a second, calendar-fixed
 * package plugs into the same function with no code change, only a new
 * `CampaignLibrarySnapshot` constant.
 */

import { nextYearlyOccurrence } from "../appointments/customer-moment";

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

function toDateOnly(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCFullYear()).padStart(4, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Finds the nearest occurrence of relationshipDate's month/day at or after
 * today via the shared `nextYearlyOccurrence`, rolling into next year if
 * this year's occurrence has already passed — this is what makes a
 * December 20 anniversary still correctly evaluate as "10 days away" when
 * today is December 10, and correctly evaluate as "356 days away" (not
 * "-355") the day after it passes. Returns midnight UTC on that date, since
 * the shared function works in date-only (YYYY-MM-DD) terms.
 */
function nextOccurrence(relationshipDateIso: string, todayIso: string): Date {
  const occursOn = nextYearlyOccurrence({
    occursOn: toDateOnly(relationshipDateIso),
    fromDate: toDateOnly(todayIso),
  });
  return new Date(`${occursOn}T00:00:00.000Z`);
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

/**
 * The third of 10.4's nine named packages — PHASE.md's "annual event" entry.
 * Same shape as Anniversary: reuses an existing `customer_facts` type
 * (`'occasion'`, already in the check constraint since PHASE 7.3) rather
 * than a fixed calendar date, so it plugs into the same
 * `evaluateRelationshipDateWindow` unmodified and needs no new fact type or
 * migration. Deliberately generic — "occasion" already covers a customer's
 * own recurring annual date that isn't specifically an anniversary or
 * wedding (a personal ritual, a founding date, whatever the customer or
 * advisor recorded) rather than inventing a narrower fact type for it.
 */
export const ANNUAL_EVENT_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "annual-event-v1",
  kind: "private_offer",
  title: "Annual Event",
  summary:
    "A private note timed to a customer's own recurring occasion, not a generic seasonal blast.",
  prerequisites: [
    "personalization_consent",
    "occasion_fact",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out once the window opens — confirm this occasion still matters to the client before suggesting anything.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "occasion_date_window",
  },
};

/**
 * The second of 10.4's nine named packages — PHASE.md's own name for it is
 * "Valentine/reservation-rescue and overcoat". Unlike Anniversary, this
 * fires from a single fixed calendar date shared by every customer (February
 * 14), not a per-customer `customer_facts` row, so it needs no new fact type
 * at all — `evaluateRelationshipDateWindow` already treats
 * `relationshipDateIso` as month/day-only with the year ignored, so a
 * constant date plugs into the exact same eligibility function unmodified.
 * "Reservation-rescue": the lead window exists so a customer who has not yet
 * planned anything gets reminded while there is still time to book, not
 * after the date has already passed them by.
 */
export const VALENTINE_RESERVATION_RESCUE_LIBRARY_V1: CampaignLibrarySnapshot =
  {
    versionLabel: "valentine-reservation-rescue-v1",
    kind: "private_offer",
    title: "Valentine Reservation Rescue",
    summary:
      "A timely nudge while there is still time to prepare for Valentine's Day, not a last-minute blast after the moment has passed.",
    prerequisites: ["personalization_consent", "advisor_coverage"],
    placementHints: ["private_offers", "clienteling"],
    staffMission:
      "Reach out while there is still time to help — confirm what the client actually needs before suggesting anything.",
    outcomeMetrics: ["opened", "replied", "booked", "declined"],
    audienceTemplate: {
      consent: "personalization",
      trigger: "valentine_date_window",
    },
  };

/**
 * Mother's and Father's Day — fourth of 10.4's nine named relationship
 * packages. Uses fixed calendar dates (second Sunday of May / third Sunday
 * of June) shared by every customer — no per-customer `customer_facts` row
 * needed. Reuses the same `evaluateRelationshipDateWindow` eligibility
 * function, with the caller providing the appropriate calendar date.
 */
export const MOTHERS_AND_FATHERS_DAY_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "mothers-fathers-day-v1",
  kind: "private_offer",
  title: "Mother's and Father's Day",
  summary:
    "A timely reminder while there is still time to prepare for Mother's Day and Father's Day, not a last-minute afterthought.",
  prerequisites: ["personalization_consent", "advisor_coverage"],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out while there is still time to help the client prepare — confirm what they actually need before suggesting anything.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "parental_day_date_window",
  },
};

/**
 * Coming-of-age — fifth of 10.4's nine named relationship packages. Fires
 * from a customer's own recorded birth date (or milestone age fact) once
 * they enter the relevant age bracket. Each customer's date is unique,
 * sourced from `customer_facts` (a `birth_date` or `milestone_age` fact
 * type), so this plugs into `evaluateRelationshipDateWindow` with the
 * customer's own birthday as the recurring date.
 */
export const COMING_OF_AGE_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "coming-of-age-v1",
  kind: "private_offer",
  title: "Coming of Age",
  summary:
    "A milestone recognition timed to a customer's own birthday milestone — making the moment memorable, not a generic-age blast.",
  prerequisites: [
    "personalization_consent",
    "birth_date_fact",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out once the window opens — this is about marking the milestone, not a hard sell.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "birth_date_window",
  },
};

/**
 * Race Sunday — sixth of 10.4's nine named relationship packages. Fires
 * from a fixed calendar date (each major race day) shared by every customer
 * — no per-customer fact needed. Race dates are a known annual calendar,
 * not a customer-specific event, so the caller provides the relevant date
 * and `evaluateRelationshipDateWindow` handles the lead/trail window.
 */
export const RACE_SUNDAY_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "race-sunday-v1",
  kind: "private_offer",
  title: "Race Sunday",
  summary:
    "A timely nudge before the big race day — help the client prepare their look while there is still time to book, not after the event.",
  prerequisites: ["personalization_consent", "advisor_coverage"],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out ahead of race day — confirm what the client needs so they are event-ready.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "race_sunday_date_window",
  },
};

/**
 * Client event — seventh of 10.4's nine named relationship packages. Fires
 * from a retailer-hosted client event date (trunk show, preview evening,
 * private shopping event) — a fixed date per event, shared by invited
 * customers. No per-customer fact needed; the caller provides the event
 * date and `evaluateRelationshipDateWindow` handles the lead window so
 * invitations go out while there is still time to RSVP and prepare.
 */
export const CLIENT_EVENT_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "client-event-v1",
  kind: "private_offer",
  title: "Client Event",
  summary:
    "A personal invitation timed to an upcoming client event — ensuring the customer hears about it while there is still time to RSVP and prepare.",
  prerequisites: [
    "personalization_consent",
    "event_invitation_scheme",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out once the window opens — confirm the client's interest and prepare any fitting or consultation ahead of the event.",
  outcomeMetrics: ["opened", "replied", "booked", "attended", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "client_event_date_window",
  },
};

/**
 * Dating / single-again — eighth of 10.4's nine named packages and the
 * first sensitive-context package. Requires confirmed context (the customer
 * has explicitly shared that they are dating or newly single) and a human
 * rehearsal gate before any outreach — the package is never auto-activated
 * without a staff member reviewing and approving the message. Fires from a
 * per-customer `customer_facts` fact (e.g. a recorded `single_again_date`
 * or `dating_since` fact type).
 */
export const DATING_SINGLE_AGAIN_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "dating-single-again-v1",
  kind: "private_offer",
  title: "Dating / Single Again",
  summary:
    "A sensitive-context touchpoint for customers who have shared they are dating or newly single — requires confirmed context and human-approved outreach only, never automated.",
  prerequisites: [
    "personalization_consent",
    "dating_single_again_fact",
    "advisor_coverage",
    "human_rehearsal_required",
  ],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Review the customer's context before reaching out — this is a sensitive moment that requires care, not a script.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "dating_single_again_date_window",
  },
};

/**
 * Referral — ninth of 10.4's nine named relationship packages. Fires based
 * on a referral event (a referred customer has booked, been measured, or
 * placed an order) — the referrer gets a recognition touchpoint. The date
 * is event-driven (the referral outcome date), not a recurring calendar
 * date, so `evaluateRelationshipDateWindow` handles the post-event window.
 */
export const REFERRAL_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "referral-v1",
  kind: "private_offer",
  title: "Referral",
  summary:
    "A recognition touchpoint after a referred customer takes their first meaningful step — booking, measurement, or order — making the referrer feel appreciated, not forgotten.",
  prerequisites: [
    "personalization_consent",
    "referral_outcome",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "clienteling"],
  staffMission:
    "Reach out once the referral window opens — a genuine thank-you matters more than a scripted discount push.",
  outcomeMetrics: ["opened", "replied", "booked", "declined"],
  audienceTemplate: {
    consent: "personalization",
    trigger: "referral_date_window",
  },
};
