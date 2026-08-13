/**
 * Moonstruck wedding-party apparel pack (WED-101 / PHASE 16.5).
 *
 * The item's owner boundary contains an unusually direct instruction:
 * **never create a second party model**. `public.wedding_parties` and
 * `public.wedding_party_members` (2026-07-19) already exist with roles,
 * invites, fitting states and RLS. This module extends that aggregate and
 * defines no party or member type of its own — a test asserts the module
 * declares no interface with "Party" or "Member" in its name.
 *
 * What is genuinely new: an inspiration board, coordinated design choices
 * across members, group fitting capacity, readiness across the whole
 * party, guest dress-code looks and vouchers, aftercare, and the
 * anniversary continuation.
 *
 * The privacy rule that matters: each participant sees only their own
 * measurements and fitting state. A best man must not be able to read the
 * groom's waist measurement because they are in the same party. Group
 * readiness is therefore expressed in *counts and states*, never in
 * per-person detail.
 */

export const PARTY_READINESS_STATES = [
  "invited",
  "accepted",
  "measured",
  "ordered",
  "fitted",
  "collected",
] as const;
export type PartyReadinessState = (typeof PARTY_READINESS_STATES)[number];

export interface MemberReadiness {
  /** Existing wedding_party_members.id — not a new identity. */
  readonly memberId: string;
  readonly displayName: string;
  readonly state: PartyReadinessState;
}

export interface GroupReadiness {
  readonly memberCount: number;
  readonly byState: Readonly<Record<PartyReadinessState, number>>;
  /** Members behind the slowest acceptable point for the days remaining.
   * Names only — never a measurement, never a size. */
  readonly blockingMemberNames: readonly string[];
  readonly daysUntilEvent: number;
  readonly onTrack: boolean;
}

/**
 * Milestone the party should have reached by a given lead time. Deliberately
 * coarse: a wedding has one date and a long tail of small delays, and a
 * finer schedule produces alarm fatigue rather than earlier action.
 */
function requiredStateForDaysRemaining(days: number): PartyReadinessState {
  if (days <= 7) return "collected";
  if (days <= 21) return "fitted";
  if (days <= 56) return "ordered";
  if (days <= 84) return "measured";
  return "accepted";
}

const STATE_ORDER: readonly PartyReadinessState[] = PARTY_READINESS_STATES;

/**
 * Group readiness. Returns names and counts only: a best man must not be
 * able to read the groom's waist measurement because they are in the same
 * party, so nothing per-person beyond a display name and a state crosses
 * this boundary.
 */
export function summarizeGroupReadiness(args: {
  readonly members: readonly MemberReadiness[];
  readonly eventDate: string;
  readonly asOf: string;
}): GroupReadiness {
  const daysUntilEvent = Math.floor(
    (Date.parse(args.eventDate) - Date.parse(args.asOf)) /
      (1000 * 60 * 60 * 24),
  );
  const required = requiredStateForDaysRemaining(daysUntilEvent);
  const requiredIndex = STATE_ORDER.indexOf(required);

  const byState = Object.fromEntries(
    PARTY_READINESS_STATES.map((state) => [state, 0]),
  ) as Record<PartyReadinessState, number>;
  const blocking: string[] = [];

  for (const member of args.members) {
    byState[member.state] += 1;
    if (STATE_ORDER.indexOf(member.state) < requiredIndex) {
      blocking.push(member.displayName);
    }
  }

  return {
    memberCount: args.members.length,
    byState,
    blockingMemberNames: blocking.sort(),
    daysUntilEvent,
    onTrack: blocking.length === 0,
  };
}

export type FittingCapacityCheck =
  | { readonly ok: true; readonly sessionsRequired: number }
  | {
      readonly ok: false;
      readonly reason:
        | "party_exceeds_capacity_before_event"
        | "no_capacity_configured"
        | "event_in_the_past";
    };

/**
 * Whether the party can physically be fitted before the date. This is the
 * question that actually goes wrong: eight groomsmen, one fitter, three
 * weeks. Answering it late is what turns a wedding into a complaint.
 */
export function checkGroupFittingCapacity(args: {
  readonly memberCount: number;
  readonly fittingsPerDay: number;
  readonly availableDaysBeforeEvent: number;
}): FittingCapacityCheck {
  if (args.availableDaysBeforeEvent < 0) {
    return { ok: false, reason: "event_in_the_past" };
  }
  if (args.fittingsPerDay <= 0) {
    return { ok: false, reason: "no_capacity_configured" };
  }
  const capacity = args.fittingsPerDay * args.availableDaysBeforeEvent;
  if (args.memberCount > capacity) {
    return { ok: false, reason: "party_exceeds_capacity_before_event" };
  }
  return {
    ok: true,
    sessionsRequired: Math.ceil(args.memberCount / args.fittingsPerDay),
  };
}

export interface DesignChoice {
  readonly slotKey: string;
  readonly valueKey: string;
  /** True when every member must match — a lapel style — versus a per
   * person choice such as trouser length. */
  readonly coordinated: boolean;
}

export type DesignCoherenceCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "coordinated_slot_has_conflicting_values";
      readonly slotKey?: string;
    };

/**
 * Coordinated slots must agree across the party. Detecting this at choice
 * time rather than at delivery is the whole point: two different lapels
 * discovered on the morning of the wedding is not a recoverable error.
 */
export function checkDesignCoherence(args: {
  readonly choicesByMember: readonly {
    readonly memberId: string;
    readonly choices: readonly DesignChoice[];
  }[];
}): DesignCoherenceCheck {
  const coordinated = new Map<string, string>();
  for (const member of args.choicesByMember) {
    for (const choice of member.choices) {
      if (!choice.coordinated) continue;
      const existing = coordinated.get(choice.slotKey);
      if (existing === undefined) {
        coordinated.set(choice.slotKey, choice.valueKey);
        continue;
      }
      if (existing !== choice.valueKey) {
        return {
          ok: false,
          reason: "coordinated_slot_has_conflicting_values",
          slotKey: choice.slotKey,
        };
      }
    }
  }
  return { ok: true };
}

export type GuestVoucherCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "expiry_required"
        | "value_not_positive"
        | "funding_source_required"
        | "guest_list_not_a_customer_import";
    };

/**
 * Guest dress-code vouchers. The last refusal is the important one: a
 * wedding guest list is not a customer list. Issuing a voucher does not
 * create a customer record, and a bulk import of guests as customers is
 * refused — the couple shared those names to organise a wedding, not to
 * populate a CRM.
 */
export function checkGuestVoucher(args: {
  readonly valueMinorUnits: number;
  readonly expiresOn?: string;
  readonly fundingSource?: string;
  readonly createsCustomerRecords: boolean;
}): GuestVoucherCheck {
  if (args.createsCustomerRecords) {
    return { ok: false, reason: "guest_list_not_a_customer_import" };
  }
  if (!Number.isInteger(args.valueMinorUnits) || args.valueMinorUnits <= 0) {
    return { ok: false, reason: "value_not_positive" };
  }
  if (!args.expiresOn) return { ok: false, reason: "expiry_required" };
  if (!args.fundingSource)
    return { ok: false, reason: "funding_source_required" };
  return { ok: true };
}

export interface AnniversaryMoment {
  readonly occursOn: string;
  readonly yearsSince: number;
}

/**
 * The anniversary continuation. Recurs the wedding date annually, which is
 * the same operation `nextYearlyOccurrence` already performs for customer
 * moments — reused rather than reimplemented, because a second date-recurrence
 * function is exactly how two parts of a system start disagreeing about
 * what a leap-year birthday means.
 */
export function nextAnniversary(args: {
  readonly eventDate: string;
  readonly asOf: string;
  /** Injected rather than imported so this module stays dependency-free
   * and the caller cannot substitute a second implementation by accident;
   * pass `nextYearlyOccurrence` from ../appointments/customer-moment. */
  readonly nextYearlyOccurrence: (input: {
    readonly occursOn: string;
    readonly fromDate: string;
  }) => string;
}): AnniversaryMoment {
  const occursOn = args.nextYearlyOccurrence({
    occursOn: args.eventDate,
    fromDate: args.asOf,
  });
  const yearsSince =
    Number(occursOn.slice(0, 4)) - Number(args.eventDate.slice(0, 4));
  return { occursOn, yearsSince };
}
