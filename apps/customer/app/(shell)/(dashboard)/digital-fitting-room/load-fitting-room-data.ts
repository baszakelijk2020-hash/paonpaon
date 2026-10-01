import {
  MetadataRepository,
  OutfitRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  RetailerVisualPresetRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  WardrobeRepository,
  WardrobeVisualizationJobRepository,
  WishlistRepository,
  type PaonSupabaseClient,
} from "@paon/database";
import {
  buildFitArchetypeOptions,
  garmentCategoryToOutfitSlot,
  isSavedLook,
  type Customer,
  type FitArchetypeOption,
  type Outfit,
  type Retailer,
  type StylePortrait,
  type StylePortraitConsent,
  type WardrobeVisualizationJob,
} from "@paon/domain";

import {
  inferSlotKindFromName,
  type ComposableItem,
  type SaveableProduct,
} from "./fitting-room-types";

export interface FittingRoomData {
  customer: Customer;
  retailer: Retailer | null;
  composableItems: readonly ComposableItem[];
  outfits: readonly Outfit[];
  latestJobByOutfitId: Record<string, WardrobeVisualizationJob>;
  canGenerate: boolean;
  consent: StylePortraitConsent;
  portrait: StylePortrait | null;
  portraitPreviewJob: WardrobeVisualizationJob | null;
  fitArchetypes: readonly FitArchetypeOption[];
  preloadKey: string | undefined;
  /** Catalogue pieces not saved yet, for the tray's "Find more" picker. */
  favorites: readonly SaveableProduct[];
  /** Signed thumbnail URL per style-portrait reference id (private bucket). */
  referencePreviews: Readonly<Record<string, string>>;
}

const REFERENCE_PREVIEW_TTL_SECONDS = 60 * 60;
const MAX_SAVEABLE_PRODUCTS = 24;

export async function loadFittingRoomData(
  supabase: PaonSupabaseClient,
  customers: Customer[],
  productSlug?: string,
  addWardrobeItemId?: string,
): Promise<FittingRoomData[]> {
  const retailerRepo = new RetailerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);
  const wishlistRepo = new WishlistRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const outfitRepo = new OutfitRepository(supabase);
  const jobRepo = new WardrobeVisualizationJobRepository(supabase);
  const portraitRepo = new StylePortraitRepository(supabase);
  const portraitConsentRepo = new StylePortraitConsentRepository(supabase);
  const presetRepo = new RetailerVisualPresetRepository(supabase);
  const metadataRepo = new MetadataRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const items = await wardrobeRepo.findByCustomer(customer.id);

      const composableItems: ComposableItem[] = items
        .filter((item) => !item.retiredAt && !item.deletedAt)
        .map((item) => {
          const suggestedSlotKind = garmentCategoryToOutfitSlot(
            item.categoryCode,
          );
          return {
            key: `wardrobe:${item.id}`,
            kind: "wardrobe" as const,
            id: item.id,
            label: item.displayName,
            ...(item.identifyingPhotoUrl
              ? { imageUrl: item.identifyingPhotoUrl }
              : {}),
            ...(suggestedSlotKind ? { suggestedSlotKind } : {}),
          };
        });

      const wishlist = await wishlistRepo.findByCustomer(customer.id);
      if (wishlist) {
        const wishlistItems = await wishlistRepo.findItems(wishlist.id);
        const seenProductIds = new Set<string>();
        for (const wishlistItem of wishlistItems) {
          const variant = await variantRepo.findById(
            wishlistItem.productVariantId,
          );
          if (!variant || seenProductIds.has(variant.productId)) continue;
          seenProductIds.add(variant.productId);
          const product = await productRepo.findById(variant.productId);
          if (!product) continue;
          const slot = inferSlotKindFromName(product.name);
          composableItems.push({
            key: `product:${product.id}`,
            kind: "product",
            id: product.id,
            label: product.name,
            ...(product.primaryImageUrl
              ? { imageUrl: product.primaryImageUrl }
              : {}),
            ...(slot ? { suggestedSlotKind: slot } : {}),
          });
        }
      }

      let preloadKey: string | undefined;
      if (productSlug) {
        const product = await productRepo.findBySlug(
          customer.retailerId,
          productSlug,
        );
        if (product) {
          const key = `product:${product.id}`;
          preloadKey = key;
          if (!composableItems.some((entry) => entry.key === key)) {
            const slot = inferSlotKindFromName(product.name);
            composableItems.push({
              key,
              kind: "product",
              id: product.id,
              label: product.name,
              ...(product.primaryImageUrl
                ? { imageUrl: product.primaryImageUrl }
                : {}),
              ...(slot ? { suggestedSlotKind: slot } : {}),
            });
          }
        }
      } else if (addWardrobeItemId) {
        const key = `wardrobe:${addWardrobeItemId}`;
        if (composableItems.some((entry) => entry.key === key)) {
          preloadKey = key;
        }
      }

      const outfits: Outfit[] = (
        await outfitRepo.findByCustomer(customer.id)
      ).filter(isSavedLook);
      const latestJobByOutfitId: Record<string, WardrobeVisualizationJob> = {};
      await Promise.all(
        outfits.map(async (outfit) => {
          const jobs = await jobRepo.findByOutfit(outfit.id);
          if (jobs[0]) latestJobByOutfitId[outfit.id] = jobs[0];
        }),
      );

      const portrait = await portraitRepo.findApprovedForCustomer(customer.id);
      const draftPortrait =
        portrait ?? (await portraitRepo.findLatestForCustomer(customer.id));
      const portraitPreviewJob = draftPortrait
        ? await jobRepo.findLatestStylePortraitPreview(draftPortrait.id)
        : null;
      const consent = await portraitConsentRepo.findForCustomer(
        customer.retailerId,
        customer.id,
      );
      const defaultPreset = await presetRepo.findDefaultForRetailer(
        customer.retailerId,
      );
      const canGenerate = Boolean(
        portrait &&
        defaultPreset &&
        consent.status === "granted" &&
        consent.disclosuresAcknowledged,
      );
      const fitConcepts = await metadataRepo.findVisibleConcepts(
        customer.retailerId,
        "fit",
      );
      const fitArchetypes = buildFitArchetypeOptions(fitConcepts);

      const referencePreviews: Record<string, string> = {};
      await Promise.all(
        (draftPortrait?.references ?? []).map(async (reference) => {
          const { data } = await supabase.storage
            .from(reference.storageBucket)
            .createSignedUrl(
              reference.storagePath,
              REFERENCE_PREVIEW_TTL_SECONDS,
            );
          if (data?.signedUrl) referencePreviews[reference.id] = data.signedUrl;
        }),
      );

      const savedProductIds = new Set(
        composableItems
          .filter((entry) => entry.kind === "product")
          .map((entry) => entry.id),
      );
      const favorites: SaveableProduct[] = [];
      const catalogue = (await productRepo.findByRetailer(customer.retailerId))
        .filter(
          (product) =>
            product.status === "active" &&
            Boolean(product.primaryImageUrl) &&
            !savedProductIds.has(product.id),
        )
        .slice(0, MAX_SAVEABLE_PRODUCTS);
      const variantsByProduct = await variantRepo.findByProducts(
        catalogue.map((product) => product.id),
      );
      for (const product of catalogue) {
        const variant = variantsByProduct.get(product.id)?.[0];
        if (!variant) continue;
        const slot = inferSlotKindFromName(product.name);
        favorites.push({
          productId: product.id,
          variantId: variant.id,
          name: product.name,
          ...(product.primaryImageUrl
            ? { imageUrl: product.primaryImageUrl }
            : {}),
          ...(slot ? { suggestedSlotKind: slot } : {}),
        });
      }

      return {
        customer,
        retailer,
        composableItems,
        outfits,
        latestJobByOutfitId,
        canGenerate,
        consent,
        portrait: draftPortrait,
        portraitPreviewJob,
        fitArchetypes,
        preloadKey,
        favorites,
        referencePreviews,
      };
    }),
  );

  return groups;
}
