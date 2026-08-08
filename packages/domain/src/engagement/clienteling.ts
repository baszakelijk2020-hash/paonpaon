import type {
  ClientelingNoteId,
  CustomerId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

/**
 * Need-to-know read tier (ADR-074). `assignedAdvisor` is the default for
 * new notes — narrow by design, since notes routinely carry family/
 * personal context and commercial observations. `retailerShared` is the
 * pre-existing retailer-wide behavior, now an explicit author choice
 * rather than the only option. Enforced at the database (RLS), not just
 * here — this type exists so UI can render/offer the same vocabulary.
 */
export type NoteVisibility =
  "author_only" | "assigned_advisor" | "management" | "retailer_shared";

export const NOTE_VISIBILITY_OPTIONS: readonly NoteVisibility[] = [
  "author_only",
  "assigned_advisor",
  "management",
  "retailer_shared",
];

export const NOTE_VISIBILITY_LABELS: Record<NoteVisibility, string> = {
  author_only: "Only me",
  assigned_advisor: "Me + this customer's assigned advisor",
  management: "Managers and above",
  retailer_shared: "Everyone at this House",
};

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
  readonly visibility: NoteVisibility;
}
