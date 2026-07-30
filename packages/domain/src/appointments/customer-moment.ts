/**
 * Recurring customer moments on the shared calendar (CLI-006 / PHASE 7.5).
 */

import type {
  AppointmentId,
  CustomerId,
  CustomerMomentId,
  RetailerBranchId,
  RetailerId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export const CUSTOMER_MOMENT_TYPES = [
  "anniversary",
  "wedding",
  "travel",
  "bonus_window",
  "follow_up",
  "other",
] as const;

export type CustomerMomentType = (typeof CUSTOMER_MOMENT_TYPES)[number];

export const CUSTOMER_MOMENT_RECURRENCES = [
  "none",
  "yearly",
  "monthly",
] as const;

export type CustomerMomentRecurrence =
  (typeof CUSTOMER_MOMENT_RECURRENCES)[number];

export interface CustomerMoment extends Timestamps {
  readonly id: CustomerMomentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly branchId?: RetailerBranchId;
  readonly appointmentId?: AppointmentId;
  readonly momentType: CustomerMomentType;
  readonly label: string;
  readonly occursOn: string;
  readonly recurrence: CustomerMomentRecurrence;
  readonly timezone: string;
  readonly notes?: string;
}

export function nextYearlyOccurrence(args: {
  readonly occursOn: string;
  readonly fromDate: string;
}): string {
  const [y, m, d] = args.occursOn.split("-").map(Number);
  const [fy, fm, fd] = args.fromDate.split("-").map(Number);
  const month = m ?? 1;
  const day = d ?? 1;
  let year = fy ?? 1970;
  const candidate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (
    candidate <
    `${String(fy).padStart(4, "0")}-${String(fm).padStart(2, "0")}-${String(fd).padStart(2, "0")}`
  ) {
    year += 1;
  }
  // Preserve original year anchor when fromDate is before first occurrence.
  const originalYear = y ?? year;
  if (year < originalYear) year = originalYear;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
