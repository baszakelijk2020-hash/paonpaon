/**
 * Corporate office-visit landing pages (BD-104 / PHASE 18.4).
 *
 * The public page, the lead-capture request it collects, and — added
 * 2026-08-19 per direct founder instruction — self-service slot booking:
 * a retailer defines a pool of bookable visit slots (start/end time,
 * capacity) for a programme, and a visitor on the public page claims one
 * directly, with no staff step. Distinct from `scheduleAppointment` below,
 * which is the staff-assisted path for a request left with no self-service
 * slot chosen.
 */

import type {
  CorporateOfficeVisitRequestId,
  CorporateProgrammeId,
  CorporateVisitSlotId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const CORPORATE_OFFICE_VISIT_REQUEST_STATUSES = [
  "open",
  "contacted",
  "scheduled",
  "declined",
] as const;
export type CorporateOfficeVisitRequestStatus =
  (typeof CORPORATE_OFFICE_VISIT_REQUEST_STATUSES)[number];

export interface CorporateOfficeVisitRequest extends Timestamps {
  readonly id: CorporateOfficeVisitRequestId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly requesterName: string;
  readonly employeeReference?: string;
  readonly contactEmail?: string;
  readonly note?: string;
  readonly status: CorporateOfficeVisitRequestStatus;
  readonly resolvedAt?: string;
  /** Set only when staff actually scheduled a real appointment for this
   * request (PHASE 18.4's own dependency-line gap, closed) — never set
   * merely because the request was marked "scheduled". */
  readonly customerId?: string;
  readonly appointmentId?: string;
}

export interface CorporateOfficeVisitPage {
  readonly retailerDisplayName: string;
  readonly companyName: string;
  readonly programmeName: string;
}

export type SubmitOfficeVisitRequestCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "requester_name_required" };

export function checkSubmitOfficeVisitRequest(args: {
  readonly requesterName: string;
}): SubmitOfficeVisitRequestCheck {
  if (args.requesterName.trim().length === 0) {
    return { ok: false, reason: "requester_name_required" };
  }
  return { ok: true };
}

const TERMINAL_STATUSES: ReadonlySet<CorporateOfficeVisitRequestStatus> =
  new Set(["scheduled", "declined"]);

export type ResolveOfficeVisitRequestCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "already_resolved" };

/** A request already marked scheduled/declined stays there — resolving
 * twice would silently overwrite which outcome actually happened. */
export function checkResolveOfficeVisitRequest(args: {
  readonly currentStatus: CorporateOfficeVisitRequestStatus;
}): ResolveOfficeVisitRequestCheck {
  if (TERMINAL_STATUSES.has(args.currentStatus)) {
    return { ok: false, reason: "already_resolved" };
  }
  return { ok: true };
}

export type ScheduleOfficeVisitAppointmentCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "contact_email_required" }
  | { readonly ok: false; readonly reason: "invalid_time_window" };

/**
 * A real appointment needs a real way to reach the person and a real
 * time — never fabricated. A requester who left no contact email can
 * still be marked "scheduled" (staff coordinated it another way, e.g.
 * by phone) but this codebase has no channel to book a real appointment
 * for them, so that path stays honestly appointment-less rather than
 * inventing one.
 */
export function checkScheduleOfficeVisitAppointment(args: {
  readonly contactEmail?: string;
  readonly startsAt: string;
  readonly endsAt: string;
}): ScheduleOfficeVisitAppointmentCheck {
  if (!args.contactEmail || args.contactEmail.trim().length === 0) {
    return { ok: false, reason: "contact_email_required" };
  }
  if (!(Date.parse(args.startsAt) < Date.parse(args.endsAt))) {
    return { ok: false, reason: "invalid_time_window" };
  }
  return { ok: true };
}

/**
 * A retailer-defined, bookable window against one corporate programme —
 * not tied to a specific staff member (corporate programmes have no
 * staff-assignment concept; this is the retailer's own capacity pool for
 * that programme's office visits). `capacity` is the number of visitors
 * who can book this exact slot; `bookedCount` is a live count the DB
 * maintains, never trusted from client input.
 */
export interface CorporateVisitSlot extends Timestamps {
  readonly id: CorporateVisitSlotId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly capacity: number;
  readonly bookedCount: number;
  readonly canceledAt?: string;
}

export type CreateVisitSlotCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "invalid_time_window" }
  | { readonly ok: false; readonly reason: "capacity_must_be_positive" };

export function checkCreateVisitSlot(args: {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly capacity: number;
}): CreateVisitSlotCheck {
  if (!(Date.parse(args.startsAt) < Date.parse(args.endsAt))) {
    return { ok: false, reason: "invalid_time_window" };
  }
  if (!Number.isInteger(args.capacity) || args.capacity < 1) {
    return { ok: false, reason: "capacity_must_be_positive" };
  }
  return { ok: true };
}

/**
 * Pure eligibility check mirrored by the DB's own atomic claim (the RPC
 * re-checks this same condition inside a row lock — see
 * claim_corporate_visit_slot). This copy exists so the UI can refuse an
 * obviously-full slot before round-tripping to the server, not as the
 * actual enforcement: two browsers reading "1 of 2 booked" at the same
 * instant and both passing this check is exactly the race the DB-level
 * lock exists to close, which this pure function cannot.
 */
export type ClaimVisitSlotCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "slot_full" }
  | { readonly ok: false; readonly reason: "slot_canceled" }
  | { readonly ok: false; readonly reason: "slot_in_past" };

export function checkClaimVisitSlot(args: {
  readonly slot: Pick<
    CorporateVisitSlot,
    "capacity" | "bookedCount" | "canceledAt" | "startsAt"
  >;
  readonly now?: string;
}): ClaimVisitSlotCheck {
  if (args.slot.canceledAt) {
    return { ok: false, reason: "slot_canceled" };
  }
  const now = args.now ?? new Date().toISOString();
  if (Date.parse(args.slot.startsAt) <= Date.parse(now)) {
    return { ok: false, reason: "slot_in_past" };
  }
  if (args.slot.bookedCount >= args.slot.capacity) {
    return { ok: false, reason: "slot_full" };
  }
  return { ok: true };
}
