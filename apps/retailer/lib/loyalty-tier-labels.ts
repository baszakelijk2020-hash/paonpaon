import type { LoyaltyTier } from "@paon/domain";

/** Retailer-facing tier labels — uppercase branded form of the same
 * three tiers the domain type now uses directly (metre/milli/micron). */
export const RETAILER_LOYALTY_TIER_LABELS: Record<LoyaltyTier, string> = {
  metre: "METRE",
  milli: "MILLI",
  micron: "MICRON",
};
