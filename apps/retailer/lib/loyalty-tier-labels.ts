import type { LoyaltyTier } from "@paon/domain";

/**
 * Retailer-facing tier labels mapping.
 * Domain enum values (member/silver/gold/platinum) are mapped to
 * display labels (METRE/MILLI/MICRON) as specified in PHASE.md.
 *
 * Mapping:
 * - member → METRE (entry level)
 * - silver → MILLI (intermediate)
 * - gold → MICRON (premium)
 * - platinum → MICRON (highest premium)
 */
export const RETAILER_LOYALTY_TIER_LABELS: Record<LoyaltyTier, string> = {
  member: "METRE",
  silver: "MILLI",
  gold: "MICRON",
  platinum: "MICRON",
};
