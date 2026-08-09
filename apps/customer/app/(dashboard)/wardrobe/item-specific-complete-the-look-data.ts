import {
  SartorialRuleRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  selectItemSpecificCompleteTheLookSuggestions,
  type CompleteTheLookSuggestion,
  type CustomerId,
  type GarmentCategoryCode,
  type RetailerId,
} from "@paon/domain";

import {
  buildCategorizedCatalogue,
  buildWardrobeCandidates,
} from "./complete-the-look-catalogue";

/**
 * The QR wardrobe card's item-specific Complete the Look (PHASE 17.13 /
 * ADV-113, vision spec §17) — "distinct from the wardrobe-level
 * complete-the-look surface: this one is scoped to what pairs with _this_
 * item specifically." Computed once per distinct owned active category
 * (not once per item — every item sharing a category gets the same
 * suggestions) so `/wardrobe`'s item cards look up by category rather
 * than each re-running the query.
 */
export async function buildItemSpecificCompleteTheLookSuggestionsByCategory(params: {
  readonly supabase: PaonSupabaseClient;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly ownedActiveCategories: readonly GarmentCategoryCode[];
}): Promise<
  Readonly<
    Partial<Record<GarmentCategoryCode, readonly CompleteTheLookSuggestion[]>>
  >
> {
  const distinctCategories = [...new Set(params.ownedActiveCategories)];
  if (distinctCategories.length === 0) return {};

  const [wardrobe, catalogue, approvedRules] = await Promise.all([
    buildWardrobeCandidates({
      supabase: params.supabase,
      customerId: params.customerId,
    }),
    buildCategorizedCatalogue({
      supabase: params.supabase,
      retailerId: params.retailerId,
    }),
    new SartorialRuleRepository(params.supabase).listApprovedForRetailer(
      params.retailerId,
    ),
  ]);

  const byCategory: Partial<
    Record<GarmentCategoryCode, readonly CompleteTheLookSuggestion[]>
  > = {};
  for (const itemCategoryCode of distinctCategories) {
    byCategory[itemCategoryCode] = selectItemSpecificCompleteTheLookSuggestions(
      {
        itemCategoryCode,
        wardrobe,
        catalogue,
        approvedRules,
        retailerId: params.retailerId,
      },
    );
  }
  return byCategory;
}
