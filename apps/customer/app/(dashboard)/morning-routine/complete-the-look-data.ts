import type { PaonSupabaseClient } from "@paon/database";
import {
  selectCompleteTheLookSuggestions,
  type CompleteTheLookSuggestion,
  type CustomerId,
  type RetailerId,
} from "@paon/domain";

import {
  buildCategorizedCatalogue,
  buildWardrobeCandidates,
} from "@/app/(dashboard)/wardrobe/complete-the-look-catalogue";

/**
 * MorningRoutine's wardrobe-level Complete the Look card (PHASE 17.10).
 * Gathers the same wardrobe-ownership and catalogue-availability facts
 * `generation.ts` already gathers for the daily selection, then runs
 * `selectCompleteTheLookSuggestions` — a separate query, not a second copy
 * of that engine.
 */
export async function buildCompleteTheLookSuggestions(params: {
  readonly supabase: PaonSupabaseClient;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
}): Promise<readonly CompleteTheLookSuggestion[]> {
  const [wardrobe, catalogue] = await Promise.all([
    buildWardrobeCandidates({
      supabase: params.supabase,
      customerId: params.customerId,
    }),
    buildCategorizedCatalogue({
      supabase: params.supabase,
      retailerId: params.retailerId,
    }),
  ]);

  return selectCompleteTheLookSuggestions({ wardrobe, catalogue });
}
