/**
 * Pre/during/post-appointment advisor brief (ADV-103 / PHASE 17.3).
 *
 * `AdvisorPreparationBriefCard` (retailer app) already composites
 * Self-Portrait evidence, advisor-authored wardrobe-roadmap gaps and
 * prior notes for a customer, and the appointment detail page already
 * loads raw purchase history. This file adds the two things that
 * actually need computation, both plain published formulas — never a
 * hidden score:
 *
 * - `computePriceComfortSummary`: an average-order-value band from real
 *   order totals, with the threshold table right here to read, the same
 *   "no black box" discipline `assessRenewalRisk` (18.9) and
 *   `scoreOpportunity` (18.1) already use.
 * - `computeWishlistOwnershipGaps`: which wishlisted product variants the
 *   customer has never actually bought through this retailer — matched
 *   against real order-line product variants, never guessed from
 *   category/similarity.
 */

import type { Money } from "../shared/money";

export const PRICE_COMFORT_BANDS = [
  "value",
  "mid",
  "premium",
  "luxury",
] as const;
export type PriceComfortBand = (typeof PRICE_COMFORT_BANDS)[number];

/** Published thresholds (minor units) — a plain lookup table, not a
 * model. Changing a threshold is a code change and a PHASE.md addendum,
 * not a silent runtime tuning knob. */
export const PRICE_COMFORT_BAND_THRESHOLDS_MINOR_UNITS: Record<
  Exclude<PriceComfortBand, "value">,
  number
> = {
  mid: 50_000,
  premium: 150_000,
  luxury: 400_000,
};

export interface PriceComfortSummary {
  readonly band: PriceComfortBand;
  readonly averageOrderValue: Money;
  readonly orderCount: number;
}

/** Returns `null` for a customer with no orders yet — never a fabricated
 * "value" band with nothing behind it. */
export function computePriceComfortSummary(
  orders: readonly Money[],
): PriceComfortSummary | null {
  if (orders.length === 0) return null;
  const currency = orders[0]!.currency;
  const totalMinorUnits = orders.reduce(
    (sum, order) => sum + order.amountMinorUnits,
    0,
  );
  const averageMinorUnits = Math.round(totalMinorUnits / orders.length);
  const band: PriceComfortBand =
    averageMinorUnits >= PRICE_COMFORT_BAND_THRESHOLDS_MINOR_UNITS.luxury
      ? "luxury"
      : averageMinorUnits >= PRICE_COMFORT_BAND_THRESHOLDS_MINOR_UNITS.premium
        ? "premium"
        : averageMinorUnits >= PRICE_COMFORT_BAND_THRESHOLDS_MINOR_UNITS.mid
          ? "mid"
          : "value";
  return {
    band,
    averageOrderValue: { amountMinorUnits: averageMinorUnits, currency },
    orderCount: orders.length,
  };
}

export interface WishlistOwnershipGap {
  readonly productVariantId: string;
}

/**
 * A wishlisted variant the customer has never actually bought through
 * this retailer. Matched against real order-line product variants only
 * — a variant the customer owns via any other route (gifted, bought
 * elsewhere) is out of scope, since PAON has no honest way to know
 * about it; this never guesses from category or price similarity.
 */
export function computeWishlistOwnershipGaps(args: {
  readonly wishlistProductVariantIds: readonly string[];
  readonly purchasedProductVariantIds: ReadonlySet<string>;
}): readonly WishlistOwnershipGap[] {
  const seen = new Set<string>();
  const gaps: WishlistOwnershipGap[] = [];
  for (const productVariantId of args.wishlistProductVariantIds) {
    if (
      seen.has(productVariantId) ||
      args.purchasedProductVariantIds.has(productVariantId)
    ) {
      continue;
    }
    seen.add(productVariantId);
    gaps.push({ productVariantId });
  }
  return gaps;
}
