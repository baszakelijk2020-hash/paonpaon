import {
  MetadataRepository,
  ProductRepository,
  ProductVariantRepository,
  WardrobeRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  resolveGarmentCategoryFromConcepts,
  type CustomerId,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineWardrobeCandidate,
  type RetailerId,
} from "@paon/domain";

const MAX_CATALOGUE_PRODUCTS_SCANNED = 30;

/**
 * Shared wardrobe-ownership gathering for both Complete the Look surfaces
 * (PHASE 17.10's wardrobe-level card and PHASE 17.13's item-specific one)
 * — the same shape `generation.ts` gathers for the daily selection, kept
 * in one place rather than copied per caller.
 */
export async function buildWardrobeCandidates(params: {
  readonly supabase: PaonSupabaseClient;
  readonly customerId: CustomerId;
}): Promise<readonly MorningRoutineWardrobeCandidate[]> {
  const items = await new WardrobeRepository(params.supabase).findByCustomer(
    params.customerId,
  );
  return items.map((item) => ({
    wardrobeItemId: item.id,
    displayName: item.displayName,
    categoryCode: item.categoryCode,
    condition: item.condition,
    careState: item.careState,
    ...(item.retiredAt ? { retiredAt: item.retiredAt } : {}),
    ...(item.deletedAt ? { deletedAt: item.deletedAt } : {}),
  }));
}

/**
 * Shared catalogue gathering for both Complete the Look surfaces.
 * Catalogue products carry no `category_code` column, so each candidate's
 * category is resolved via `resolveGarmentCategoryFromConcepts` against
 * its accepted `garment_type` metadata concepts; a product with no
 * resolvable category is excluded rather than guessed at, same
 * fail-closed posture the suggestion engines themselves use for a
 * missing `categoryCode`.
 */
export async function buildCategorizedCatalogue(params: {
  readonly supabase: PaonSupabaseClient;
  readonly retailerId: RetailerId;
}): Promise<readonly MorningRoutineCatalogueCandidate[]> {
  const { supabase, retailerId } = params;
  const metadataRepo = new MetadataRepository(supabase);
  const garmentConcepts = await metadataRepo.findVisibleConcepts(
    retailerId,
    "garment_type",
  );
  const categoryByConceptId = resolveGarmentCategoryFromConcepts({
    concepts: garmentConcepts.map((concept) => ({
      id: concept.id,
      kind: concept.kind,
      slug: concept.slug,
      label: concept.canonicalName,
    })),
  });

  const products = (
    await new ProductRepository(supabase).findByRetailer(retailerId)
  )
    .filter((product) => product.status === "active")
    .slice(0, MAX_CATALOGUE_PRODUCTS_SCANNED);
  const variantRepo = new ProductVariantRepository(supabase);

  const catalogue: MorningRoutineCatalogueCandidate[] = [];
  for (const product of products) {
    const acceptedConceptIds =
      await metadataRepo.findAcceptedConceptIdsForProduct(
        retailerId,
        product.id,
      );
    const categoryCode = acceptedConceptIds
      .map((conceptId) => categoryByConceptId.get(conceptId))
      .find((category): category is NonNullable<typeof category> =>
        Boolean(category),
      );
    if (!categoryCode) continue;

    const variants = await variantRepo.findByProduct(product.id);
    const inStock =
      variants.find((variant) => variant.inventoryQuantity > 0) ?? variants[0];
    catalogue.push({
      productId: product.id,
      ...(inStock ? { productVariantId: inStock.id } : {}),
      displayName: product.name,
      productSlug: product.slug,
      categoryCode,
      available: Boolean(inStock),
      ...(product.primaryImageUrl
        ? { primaryImageUrl: product.primaryImageUrl }
        : {}),
    });
  }

  return catalogue;
}
