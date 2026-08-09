/**
 * MorningRoutine's "Complete the look" card (PHASE 17.10 / ADV-110, vision
 * spec §14 item 3) — the third of the three-card expansion: wardrobe-
 * planning suggestions that complement what the customer already owns,
 * each with its own tap-to-generate try-on entry point (never automatic
 * generation). Reuses the same `MorningRoutineWardrobeCandidate`/
 * `MorningRoutineCatalogueCandidate` shapes the existing daily selection
 * engine already defines rather than a second candidate model. This card's
 * suggestions are gap-driven, not weather/occasion-ranked, so it earns its
 * own small function rather than a second mode bolted onto
 * `selectMorningRoutine`'s single daily selection — same "no second copy"
 * precedent `selectUpcomingOccasions` already established for the
 * "Coming up" card.
 */

import type {
  MorningRoutineCatalogueCandidate,
  MorningRoutineWardrobeCandidate,
} from "./morning-routine";
import type { GarmentCategoryCode } from "./wardrobe";

export interface CompleteTheLookSuggestion {
  readonly categoryCode: GarmentCategoryCode;
  readonly productId: string;
  readonly productVariantId?: string;
  readonly displayName: string;
  readonly productSlug: string;
  readonly primaryImageUrl?: string;
  readonly explanation: string;
}

const CATEGORY_LABELS: Record<GarmentCategoryCode, string> = {
  suit: "suit",
  jacket: "jacket",
  trousers: "pair of trousers",
  waistcoat: "waistcoat",
  shirt: "shirt",
  overcoat: "overcoat",
  coat: "coat",
  formalwear: "formalwear piece",
  denim: "denim piece",
  knitwear: "knitwear piece",
  leather: "leather piece",
  accessories: "accessory",
  shoes: "pair of shoes",
  pocket_square: "pocket square",
  other: "piece",
};

/**
 * A gap is a catalogue category the retailer actually carries that the
 * customer owns zero active (not retired, not deleted) items in —
 * data-driven, not an assumed "everyone needs N categories" opinion. Up to
 * `maxSuggestions`, one suggestion per gap category, in catalogue order —
 * never ranked by margin or novelty; this is a completion aid, not a
 * merchandising placement.
 */
export function selectCompleteTheLookSuggestions(args: {
  readonly wardrobe: readonly MorningRoutineWardrobeCandidate[];
  readonly catalogue: readonly MorningRoutineCatalogueCandidate[];
  readonly maxSuggestions?: number;
}): readonly CompleteTheLookSuggestion[] {
  const maxSuggestions = args.maxSuggestions ?? 3;
  const ownedCategories = new Set<GarmentCategoryCode>();
  for (const item of args.wardrobe) {
    if (item.deletedAt) continue;
    if (item.retiredAt) continue;
    ownedCategories.add(item.categoryCode);
  }

  const suggestions: CompleteTheLookSuggestion[] = [];
  const suggestedCategories = new Set<GarmentCategoryCode>();
  for (const product of args.catalogue) {
    if (suggestions.length >= maxSuggestions) break;
    if (!product.available) continue;
    if (!product.categoryCode) continue;
    if (ownedCategories.has(product.categoryCode)) continue;
    if (suggestedCategories.has(product.categoryCode)) continue;
    suggestedCategories.add(product.categoryCode);
    suggestions.push({
      categoryCode: product.categoryCode,
      productId: String(product.productId),
      ...(product.productVariantId
        ? { productVariantId: String(product.productVariantId) }
        : {}),
      displayName: product.displayName,
      productSlug: product.productSlug,
      ...(product.primaryImageUrl
        ? { primaryImageUrl: product.primaryImageUrl }
        : {}),
      explanation: `You don't have a ${CATEGORY_LABELS[product.categoryCode]} yet.`,
    });
  }
  return suggestions;
}
