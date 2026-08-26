import {
  CustomerRepository,
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
} from "@paon/database";
import {
  buildFitArchetypeOptions,
  garmentCategoryToOutfitSlot,
  isSavedLook,
} from "@paon/domain";
import type { Outfit, WardrobeVisualizationJob } from "@paon/domain";
import Image from "next/image";
import Link from "next/link";

import type { ComposableItem } from "./fitting-room-studio";
import { FittingRoomStudio } from "./fitting-room-studio";
import { StylePortraitPanel } from "./style-portrait-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function DigitalFittingRoomPage({
  searchParams,
}: {
  searchParams: Promise<{
    productSlug?: string;
    addWardrobeItemId?: string;
    step?: string;
  }>;
}) {
  const { productSlug, addWardrobeItemId, step } = await searchParams;
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
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
            composableItems.push({
              key,
              kind: "product",
              id: product.id,
              label: product.name,
              ...(product.primaryImageUrl
                ? { imageUrl: product.primaryImageUrl }
                : {}),
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
      };
    }),
  );

  if (step !== "avatar") {
    const preview = groups
      .flatMap((group) => group.composableItems)
      .find((item) => item.imageUrl)?.imageUrl;
    return (
      <div className="-mx-4 min-h-full bg-[linear-gradient(115deg,#283129_0%,#11150f_58%,#161510_100%)] px-4 py-8 text-white sm:-mx-7 sm:px-7 lg:-mx-10 lg:px-10 xl:-mx-14 xl:px-14">
        <section className="mx-auto grid min-h-[min(42rem,calc(100vh-9rem))] max-w-6xl overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,rgba(224,231,214,.17),rgba(26,31,23,.12)_52%,rgba(0,0,0,.18))] lg:grid-cols-[1.05fr_.95fr]">
          <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16">
            <div>
              <p className="customer-kicker text-[#c5d0c0]">
                Digital Fitting Room
              </p>
              <h1 className="font-display mt-5 max-w-xl text-5xl leading-[.94] text-white sm:text-7xl">
                See a look take shape before you ask for it.
              </h1>
              <p className="mt-7 max-w-md text-base leading-7 text-white/70">
                Build a private digital portrait, bring in pieces you own or are
                considering, then create looks with your advisor.
              </p>
              <ol className="mt-10 grid max-w-xl gap-3 sm:grid-cols-3">
                {[
                  ["01", "Create your digital portrait"],
                  ["02", "Choose real pieces"],
                  ["03", "Create a look"],
                ].map(([number, label]) => (
                  <li
                    key={number}
                    className="border-l border-white/20 pl-3 text-sm leading-5 text-white/75"
                  >
                    <span className="block text-[10px] tracking-[0.16em] text-[#c5d0c0]">
                      {number}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-12 flex flex-wrap items-center gap-5">
              <Link
                href="/digital-fitting-room?step=avatar"
                className="rounded-[15px] bg-[#dce3d6] px-6 py-4 text-sm font-medium text-[#182018] transition hover:bg-white"
              >
                Start creating →
              </Link>
              <p className="max-w-xs text-xs leading-5 text-white/50">
                Two photos, your approval, then your wardrobe becomes a canvas.
                A visualisation is never a fit guarantee.
              </p>
            </div>
          </div>
          <div className="relative min-h-[22rem] overflow-hidden bg-[#b9c4b5]">
            {preview ? (
              <>
                <Image
                  src={preview}
                  alt=""
                  fill
                  unoptimized
                  className="scale-110 object-cover opacity-45 blur-2xl"
                />
                <Image
                  src={preview}
                  alt=""
                  fill
                  unoptimized
                  className="object-contain p-8"
                />
              </>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#11150f]/85 via-[#11150f]/20 to-transparent px-8 pb-8 pt-28">
              <p className="font-display text-3xl text-white">
                Your wardrobe, in motion.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="-mx-4 min-h-full bg-[linear-gradient(115deg,#283129_0%,#11150f_58%,#161510_100%)] px-4 py-8 text-white sm:-mx-7 sm:px-7 lg:-mx-10 lg:px-10 xl:-mx-14 xl:px-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="max-w-2xl">
          <p className="customer-kicker text-[#c5d0c0]">Digital Fitting Room</p>
          <h1 className="font-display mt-3 text-4xl leading-[.96] text-white sm:text-6xl">
            {groups.some((group) => group.canGenerate)
              ? "Your portrait is ready. Create a considered look."
              : "First, create a digital portrait."}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
            {groups.some((group) => group.canGenerate)
              ? "Select real wardrobe, wishlist, advisor, or catalogue pieces to create a visual look. It is not a guarantee of physical fit."
              : "Upload two reference photos, review the result, and approve it before choosing pieces and creating looks. A visual result is never a guarantee of physical fit."}
          </p>
        </header>

        {groups.length === 0 ? (
          <div
            className="rounded-[22px] bg-white/[0.08] px-6 py-16 text-center shadow-[0_20px_60px_rgba(0,0,0,.18)]"
            role="status"
          >
            <p className="text-white/70">No retailer connections yet.</p>
          </div>
        ) : (
          groups.map(
            ({
              customer,
              retailer,
              composableItems,
              outfits,
              latestJobByOutfitId,
              canGenerate,
              consent,
              portrait,
              portraitPreviewJob,
              fitArchetypes,
              preloadKey,
            }) => (
              <div key={customer.id} className="flex flex-col gap-5">
                {canGenerate ? (
                  <FittingRoomStudio
                    retailerId={customer.retailerId}
                    composableItems={composableItems}
                    outfits={outfits}
                    latestJobByOutfitId={latestJobByOutfitId}
                    canGenerate={canGenerate}
                    {...(preloadKey ? { preloadKey } : {})}
                  />
                ) : (
                  <div className="max-w-3xl rounded-[22px] bg-[linear-gradient(135deg,rgba(220,227,214,.16),rgba(255,255,255,.055))] p-1 shadow-[0_24px_80px_rgba(0,0,0,.24)]">
                    <StylePortraitPanel
                      retailerId={customer.retailerId}
                      retailerName={retailer?.displayName ?? "Retailer"}
                      consent={consent}
                      portrait={portrait}
                      previewJob={portraitPreviewJob}
                      fitArchetypes={fitArchetypes}
                    />
                  </div>
                )}
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
