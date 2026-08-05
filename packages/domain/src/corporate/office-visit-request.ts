/**
 * Corporate office-visit landing pages (BD-104 / PHASE 18.4).
 *
 * Deliberately narrow scope: the public page and the lead-capture
 * request it collects. Turning a request into a scheduled fitting slot
 * against real advisor/room capacity is 18.6's own item — this file
 * only carries the intake queue staff work from, the same relationship
 * `corporate_exceptions` (14.1) has to resolution.
 */

import type {
  CorporateOfficeVisitRequestId,
  CorporateProgrammeId,
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
