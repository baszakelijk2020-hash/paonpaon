import type { Address } from "../shared/address";
import type {
  CustomerFitProfileEntryId,
  CustomerId,
  RetailerId,
  StaffId,
  UserId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type CustomerLifecycleStage =
  "prospect" | "first_purchase" | "returning" | "vip" | "lapsed";

/**
 * A Customer is scoped to one retailer, even when the same shopper buys
 * from several PAON retailers — each relationship is modeled
 * independently because purchase history, loyalty balance and
 * clienteling notes must never leak across tenants. The optional userId
 * links to a shared Customer Portal login (a shopper can hold one User
 * across many Customer records via CustomerAccountLink).
 */
export interface Customer extends Timestamps {
  readonly id: CustomerId;
  readonly retailerId: RetailerId;
  readonly userId?: UserId;
  readonly fullName: string;
  readonly email?: string;
  readonly phone?: string;
  readonly lifecycleStage: CustomerLifecycleStage;
  readonly assignedStaffId?: StaffId;
  readonly shippingAddresses: readonly Address[];
  readonly acquisitionSource?: string;
  readonly tags: readonly string[];
}

/** Links one Customer Portal login to many per-retailer Customer records. */
export interface CustomerAccountLink {
  readonly userId: UserId;
  readonly customerId: CustomerId;
  readonly retailerId: RetailerId;
  readonly linkedAt: string;
}

export interface CustomerPreferences {
  readonly customerId: CustomerId;
  readonly preferredLocale: string;
  readonly preferredCurrency: string;
  readonly communicationChannels: readonly (
    "email" | "sms" | "push" | "in_app"
  )[];
  readonly sizeProfile?: Record<string, string>;
  readonly styleNotes?: string;
  readonly marketingOptIn: boolean;
}

/**
 * One snapshot of a customer's measurements/fit/style, recorded by
 * retailer staff after a consultation or fitting. Deliberately an
 * append-only log, not a single mutable row: "sizing history" is a
 * first-class requirement (a body changes over years, and knowing what
 * changed and when matters for tailoring), so "current" is simply the
 * most recent entry rather than a separate value kept in sync with a
 * history table. `measurements` stays a free-form map (not fixed
 * fields) because different garment categories need different
 * measurements — a jacket and a trouser share almost none — and fixing
 * the field set now would be exactly the kind of speculative
 * specificity `docs/PRINCIPLES.md` warns against.
 */
export interface CustomerFitProfileEntry {
  readonly id: CustomerFitProfileEntryId;
  readonly customerId: CustomerId;
  readonly retailerId: RetailerId;
  readonly measurements: Record<string, string>;
  readonly fitPreferences?: string;
  readonly styleNotes?: string;
  readonly recordedByStaffId?: StaffId;
  readonly recordedAt: string;
}
