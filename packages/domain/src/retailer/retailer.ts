import type { Address } from "../shared/address";
import type { RetailerId } from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type RetailerStatus =
  "pending_onboarding" | "active" | "suspended" | "churned";

export type RetailerTier = "boutique" | "house" | "maison";

export const RETAILER_TIER_LABELS: Record<RetailerTier, string> = {
  boutique: "Boutique",
  house: "House",
  maison: "Maison",
};

export const RETAILER_STATUS_LABELS: Record<RetailerStatus, string> = {
  pending_onboarding: "Pending onboarding",
  active: "Active",
  suspended: "Suspended",
  churned: "Churned",
};

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
  readonly logoUrl?: string | undefined;
  readonly faviconUrl?: string | undefined;
  readonly heroImageUrl?: string | undefined;
  readonly accentColor: string;
  readonly surfaceColor: string;
  readonly inkColor: string;
  readonly displayFont: RetailerDisplayFont;
  readonly bodyFont: RetailerBodyFont;
  readonly cornerStyle: RetailerCornerStyle;
}

export type RetailerDisplayFont = "paon_editorial" | "heritage" | "modern";
export type RetailerBodyFont = "quiet_sans" | "humanist";
export type RetailerCornerStyle = "tailored" | "soft" | "architectural";

export const DEFAULT_RETAILER_BRAND_THEME: RetailerBrandTheme = {
  accentColor: "#1a1a1a",
  surfaceColor: "#f5f3f0",
  inkColor: "#1a1a1a",
  displayFont: "paon_editorial",
  bodyFont: "quiet_sans",
  cornerStyle: "soft",
};

export interface RetailerBrandThemeVersion {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly versionNumber: number;
  readonly theme: RetailerBrandTheme;
  readonly changeNote: string;
  readonly changedByUserId?: string | undefined;
  readonly createdAt: string;
}
