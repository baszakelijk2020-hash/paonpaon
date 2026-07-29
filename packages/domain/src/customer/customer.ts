import type { Address } from "../shared/address";
import type {
  CustomerId,
  RetailerId,
  StaffId,
  UserId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type CustomerLifecycleStage =
  "prospect" | "first_purchase" | "returning" | "vip" | "lapsed";

/** A retailer-staff-set preference (not customer self-service, unlike
 * `CustomerPreferences` — this is who arranges the shipment, not what
 * the customer wants). No live carrier API integration exists; this
 * only records the choice for staff to act on manually. */
export type PreferredCarrier =
  "dhl" | "postnl" | "ups" | "fedex" | "local_courier" | "customer_pickup";

export const PREFERRED_CARRIERS: readonly PreferredCarrier[] = [
  "dhl",
  "postnl",
  "ups",
  "fedex",
  "local_courier",
  "customer_pickup",
];

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
  readonly preferredCarrier?: PreferredCarrier;
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
  readonly styleNotes?: string;
  /** Marketing purpose only — never implies personalization or location. */
  readonly marketingOptIn: boolean;
  /** Personalization / StyleProfile signals (ADR-061). Default denied. */
  readonly personalizationOptIn: boolean;
  /** Precise location for MorningRoutine etc. Separate opt-in; not required. */
  readonly locationOptIn: boolean;
  readonly personalizationWithdrawnAt?: string;
  readonly marketingWithdrawnAt?: string;
  readonly locationWithdrawnAt?: string;
}
