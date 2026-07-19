import type {
  AppointmentId,
  CustomerId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type AppointmentType =
  | "styling_consultation"
  | "fitting"
  | "alteration_fitting"
  | "personal_shopping"
  | "event";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "canceled"
  | "no_show";

export interface Appointment extends Timestamps {
  readonly id: AppointmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly staffId?: StaffId;
  readonly type: AppointmentType;
  readonly status: AppointmentStatus;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly locationId?: string;
  readonly notes?: string;
}

/** A staff member's bookable windows, consumed when generating appointment slots. */
export interface AvailabilityWindow {
  readonly staffId: StaffId;
  readonly retailerId: RetailerId;
  readonly dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly startTime: string;
  readonly endTime: string;
}
