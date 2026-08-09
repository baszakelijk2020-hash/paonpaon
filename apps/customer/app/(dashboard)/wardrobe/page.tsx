import {
  CustomerRepository,
  OutfitRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  RetailerVisualPresetRepository,
  StylePortraitConsentRepository,
  StylePortraitRepository,
  WardrobeLifecycleRepository,
  WardrobeRepository,
  WardrobeRoadmapRepository,
  WardrobeVisualizationJobRepository,
  WishlistRepository,
  type WardrobeItemServiceView,
} from "@paon/database";
import { garmentCategoryToOutfitSlot } from "@paon/domain";
import type {
  Outfit,
  WardrobeOwnershipEvent,
  WardrobeVisualizationJob,
} from "@paon/domain";

import { WardrobeLifecyclePanel } from "./lifecycle-panel";
import { WardrobeRoadmapPanel } from "./roadmap-panel";
import type { ComposableItem } from "./virtual-studio-panel";
import { VirtualStudioPanel } from "./virtual-studio-panel";
import { WardrobeHousePanel } from "./wardrobe-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function WardrobePage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);
  const roadmapRepo = new WardrobeRoadmapRepository(supabase);
  const lifecycleRepo = new WardrobeLifecycleRepository(supabase);
  const wishlistRepo = new WishlistRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const outfitRepo = new OutfitRepository(supabase);
  const jobRepo = new WardrobeVisualizationJobRepository(supabase);
  const portraitRepo = new StylePortraitRepository(supabase);
  const portraitConsentRepo = new StylePortraitConsentRepository(supabase);
  const presetRepo = new RetailerVisualPresetRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const items = await wardrobeRepo.findByCustomer(customer.id);
      const historyEntries = await Promise.all(
        items.map(async (item) => {
          const events = await wardrobeRepo.listOwnershipHistory(item.id);
          return [item.id, events] as const;
        }),
      );
      const historyByItemId: Record<string, readonly WardrobeOwnershipEvent[]> =
        Object.fromEntries(historyEntries);
      const roadmaps = await roadmapRepo.findByCustomer(customer.id, {
        customerVisibleOnly: true,
      });
      const serviceViews: WardrobeItemServiceView[] = await Promise.all(
        items.map((item) => lifecycleRepo.projectItemServiceView(item)),
      );

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
          composableItems.push({
            key: `product:${product.id}`,
            kind: "product",
            id: product.id,
            label: product.name,
            ...(product.primaryImageUrl
              ? { imageUrl: product.primaryImageUrl }
              : {}),
          });
        }
      }

      const outfits: Outfit[] = await outfitRepo.findByCustomer(customer.id);
      const latestJobByOutfitId: Record<string, WardrobeVisualizationJob> = {};
      await Promise.all(
        outfits.map(async (outfit) => {
          const jobs = await jobRepo.findByOutfit(outfit.id);
          if (jobs[0]) latestJobByOutfitId[outfit.id] = jobs[0];
        }),
      );

      const approvedPortrait = await portraitRepo.findApprovedForCustomer(
        customer.id,
      );
      const portraitConsent = await portraitConsentRepo.findForCustomer(
        customer.retailerId,
        customer.id,
      );
      const defaultPreset = await presetRepo.findDefaultForRetailer(
        customer.retailerId,
      );
      const canGenerate = Boolean(
        approvedPortrait &&
        defaultPreset &&
        portraitConsent.status === "granted" &&
        portraitConsent.disclosuresAcknowledged,
      );

      return {
        customer,
        retailer,
        items,
        historyByItemId,
        roadmaps,
        serviceViews,
        composableItems,
        outfits,
        latestJobByOutfitId,
        canGenerate,
      };
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Wardrobe
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          What you own with each house — purchases and external pieces, kept
          separate from fitting garments — plus fit freshness, longevity
          guidance, self-scan, and advisor roadmaps.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groups.map(
          ({
            customer,
            retailer,
            items,
            historyByItemId,
            roadmaps,
            serviceViews,
            composableItems,
            outfits,
            latestJobByOutfitId,
            canGenerate,
          }) => (
            <div key={customer.id} className="flex flex-col gap-4">
              <WardrobeHousePanel
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                customerId={customer.id}
                items={items}
                historyByItemId={historyByItemId}
                roadmaps={roadmaps}
              />
              <VirtualStudioPanel
                retailerId={customer.retailerId}
                retailerName={retailer?.displayName ?? "Retailer"}
                composableItems={composableItems}
                outfits={outfits}
                latestJobByOutfitId={latestJobByOutfitId}
                canGenerate={canGenerate}
              />
              <WardrobeLifecyclePanel views={serviceViews} />
              <WardrobeRoadmapPanel
                retailerName={retailer?.displayName ?? "Retailer"}
                roadmaps={roadmaps}
              />
            </div>
          ),
        )
      )}
    </div>
  );
}
