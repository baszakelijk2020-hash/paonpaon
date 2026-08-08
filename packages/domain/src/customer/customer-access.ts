import type { RetailerRole } from "../identity/role";
import type { StaffId } from "../shared/branded-id";

import type { Customer } from "./customer";

/**
 * ADR-074 Slice 1 — reuses `Customer.assignedStaffId` as the access
 * boundary; no second assignment model. Management roles keep a broader,
 * audited override (matches `is_alterations_management()`'s existing
 * owner/admin/manager precedent).
 */
export function isCustomerAssignedToStaff(
  customer: Pick<Customer, "assignedStaffId">,
  staffId: StaffId,
): boolean {
  return customer.assignedStaffId === staffId;
}

const MANAGEMENT_ROLES: readonly RetailerRole[] = ["owner", "admin", "manager"];

export function isManagementRole(role: RetailerRole): boolean {
  return MANAGEMENT_ROLES.includes(role);
}

/**
 * Whether a staff member has a legitimate relationship-data need for this
 * customer right now — the same boundary the `clienteling_notes`
 * `assigned_advisor` RLS tier enforces at the database, exposed here as a
 * pure function so Server Components/Actions can gate contact reveal and
 * detail-page sections consistently instead of re-deriving the rule.
 * Unassigned + non-management is the "no legitimate relationship" case a
 * later slice's Request Access workflow exists to bridge.
 */
export function canStaffAccessCustomerRelationshipData(
  role: RetailerRole,
  customer: Pick<Customer, "assignedStaffId">,
  staffId: StaffId | undefined,
): boolean {
  if (isManagementRole(role)) return true;
  if (!staffId) return false;
  return isCustomerAssignedToStaff(customer, staffId);
}

/**
 * Masks a phone number to the spec's own example shape: `+84 ••• ••• 238`
 * — country code and last 3 digits visible, everything else replaced by
 * two fixed-width masked groups regardless of the real digit count (so the
 * mask itself never leaks how long the underlying number is).
 */
export function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  const match = /^(\+\d{1,3})[\s-]?(.*)$/.exec(trimmed);
  const countryCode = match?.[1] ?? "";
  const rest = match ? (match[2] ?? "") : trimmed;
  const digits = rest.replace(/\D/g, "");
  if (digits.length === 0) return countryCode || "••••••••";
  if (digits.length <= 3) {
    return `${countryCode} ${"•".repeat(digits.length)}`.trim();
  }
  const last3 = digits.slice(-3);
  return `${countryCode} ••• ••• ${last3}`.trim();
}

/**
 * Masks an email to the spec's own example shape: `j••••@company.com` —
 * first local-part character visible, a fixed 4-dot mask (not the real
 * remaining length, for the same non-leaking reason as `maskPhone`), full
 * domain visible (needed to recognize a corporate/consented address at a
 * glance without exposing the mailbox itself).
 */
export function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return "•".repeat(Math.max(email.length, 4));
  const first = email.charAt(0);
  const domain = email.slice(atIndex);
  return `${first}••••${domain}`;
}

/**
 * The exact action vocabulary `record_customer_access_event` (ADR-074)
 * accepts server-side — kept here too so callers get a typo-proof type
 * instead of a raw string, without duplicating the list's meaning.
 */
export const CUSTOMER_ACCESS_EVENT_ACTIONS = [
  "customer_protected_open",
  "note_view_protected",
  "contact_reveal",
  "access_requested",
  "access_approved",
  "access_denied",
  "break_glass_used",
  "assignment_changed",
  "export_requested",
  "export_downloaded",
] as const;

export type CustomerAccessEventAction =
  (typeof CUSTOMER_ACCESS_EVENT_ACTIONS)[number];
