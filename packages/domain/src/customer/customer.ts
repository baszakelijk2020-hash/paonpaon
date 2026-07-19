import type { Address } from "../shared/address";
import type { CustomerId, RetailerId, UserId } from "../shared/branded-id";
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
  readonly assignedStaffId?: string;
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
