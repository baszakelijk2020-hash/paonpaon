import type {
  RetailerId,
  StaffId,
  StaffShiftId,
  StaffTimeEntryId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/** A scheduled shift — authored by a manager, distinct from what
 * actually happened (`StaffTimeEntry`), the same way an Alteration's
 * status is distinct from its append-only history. */
export interface StaffShift extends Timestamps {
  readonly id: StaffShiftId;
  readonly retailerId: RetailerId;
  readonly staffId: StaffId;
  /** ISO date (YYYY-MM-DD), not a timestamp — a shift belongs to a day. */
  readonly shiftDate: string;
  /** HH:MM:SS, local to the retailer — no timezone handling beyond
   * what AvailabilityWindow already accepts for the same reason. */
  readonly startTime: string;
  readonly endTime: string;
  readonly notes?: string;
}

/** Self-service clock in/out, one open entry per staff member at a
 * time (`clock_in`/`clock_out` RPCs enforce this). */
export interface StaffTimeEntry extends Timestamps {
  readonly id: StaffTimeEntryId;
  readonly retailerId: RetailerId;
  readonly staffId: StaffId;
  readonly clockInAt: string;
  readonly clockOutAt?: string;
}
