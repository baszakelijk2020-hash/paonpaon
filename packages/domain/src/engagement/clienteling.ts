import type {
  ClientelingNoteId,
  CustomerId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/**
 * Freeform notes staff keep on a customer relationship — preferences,
 * gift dates, past conversations. Distinct from CustomerPreferences
 * (structured, customer-editable) because clienteling notes are
 * staff-authored and never shown to the customer.
 */
export interface ClientelingNote extends Timestamps {
  readonly id: ClientelingNoteId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly authorStaffId: StaffId;
  readonly body: string;
  readonly pinned: boolean;
}
