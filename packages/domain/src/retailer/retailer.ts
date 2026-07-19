import type { Address } from "../shared/address";
import type { RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type RetailerStatus =
  "pending_onboarding" | "active" | "suspended" | "churned";

export type RetailerTier = "boutique" | "house" | "maison";

/**
 * The tenant root. Every tenant-scoped entity elsewhere in the domain
 * carries a retailerId that must resolve to a Retailer in "active"
 * status for any write to be permitted — enforced by Postgres RLS, not
 * just application code. See DATABASE.md.
 */
export interface Retailer extends Timestamps {
  readonly id: RetailerId;
  readonly legalName: string;
  readonly displayName: string;
  readonly slug: string;
  readonly status: RetailerStatus;
  readonly tier: RetailerTier;
  readonly primaryDomain?: string;
  readonly billingAddress: Address;
  readonly defaultCurrency: string;
  readonly defaultLocale: string;
  readonly brandTheme: RetailerBrandTheme;
}

/** Retailer-level overrides layered on top of @paon/ui design tokens. */
export interface RetailerBrandTheme {
  readonly logoUrl?: string;
  readonly accentColor?: string;
  readonly displayFont?: string;
}
