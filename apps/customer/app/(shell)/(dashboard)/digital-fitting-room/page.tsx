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
} from "@paon/database";
import {
  buildFitArchetypeOptions,
  garmentCategoryToOutfitSlot,
  isSavedLook,
} from "@paon/domain";
import type { Outfit, WardrobeVisualizationJob } from "@paon/domain";
import Image from "next/image";
import Link from "next/link";

import "./fitting-environment.css";

import type { ComposableItem } from "./fitting-room-studio";
import { FittingRoomStudio } from "./fitting-room-studio";
import { StylePortraitPanel } from "./style-portrait-panel";

import { getCustomersForUser } from "@/lib/customer-context";
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

  const customers = await getCustomersForUser(session.userId);
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
  const hasSavedOutfits = groups.some((group) => group.outfits.length > 0);
  const invitationImage = groups
    .flatMap((group) => [
      group.portrait?.previewImageUrl,
      group.portraitPreviewJob?.outputImageUrl,
      ...group.outfits.map((outfit) =>
        group.latestJobByOutfitId[outfit.id]?.status === "ready"
          ? group.latestJobByOutfitId[outfit.id]?.outputImageUrl
          : undefined,
      ),
      ...group.composableItems.map((item) => item.imageUrl),
    ])
    .find((imageUrl): imageUrl is string => Boolean(imageUrl));

  if (step !== "avatar") {
    return (
      <div className="pe-fitting pe-fitting-entry min-h-full py-4">
        <section className="pe-fitting-invitation mx-auto mt-4 max-w-5xl overflow-hidden rounded-[32px] shadow-[0_32px_100px_rgba(0,0,0,.34)]">
          <div className="grid lg:grid-cols-[1.1fr_.9fr]">
            <div className="pe-fitting-invitation-copy p-8 sm:p-12 lg:p-14">
              <p className="customer-kicker text-[#cfd8c6]">
                Digital Fitting Room
              </p>
              <h1 className="font-display mt-5 max-w-xl text-4xl leading-[.92] text-white sm:text-6xl">
                A new way to see yourself.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-white/70">
                Build a private digital portrait, bring in pieces you own or are
                considering, then create looks with your advisor. A
                visualisation is never a guarantee of physical fit.
              </p>
              <ol className="mt-10 grid max-w-lg gap-5 sm:grid-cols-3">
                {[
                  ["01", "Create your digital portrait"],
                  ["02", "Choose real pieces"],
                  ["03", "Create a look"],
                ].map(([number, label]) => (
                  <li
                    key={number}
                    className="border-l border-white/25 pl-3 text-sm leading-5 text-white/75"
                  >
                    <span className="block text-[10px] tracking-[0.16em] text-[#c5d0c0]">
                      {number}
                    </span>
                    {label}
                  </li>
                ))}
              </ol>
              <div className="mt-11 space-y-4">
                <Link
                  href="/digital-fitting-room?step=avatar"
                  className="pe-fitting-cta inline-block rounded-[15px] px-6 py-4 text-sm font-medium shadow-[0_10px_24px_rgba(0,0,0,.2)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  Start creating
                </Link>
                {hasSavedOutfits ? (
                  <Link
                    href="/digital-fitting-room?step=avatar"
                    className="pe-fitting-secondary block w-fit text-sm underline decoration-white/35 underline-offset-4 transition hover:text-white"
                  >
                    View saved drafts &amp; results
                  </Link>
                ) : (
                  <p className="text-sm text-white/60">
                    No saved drafts or results yet.
                  </p>
                )}
              </div>
            </div>
            {invitationImage ? (
              <div className="pe-fitting-invitation-image relative min-h-[360px] overflow-hidden lg:min-h-full">
                <Image
                  src={invitationImage}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 36vw, 100vw"
                  className="object-contain p-8"
                  unoptimized
                />
              </div>
            ) : (
              <div className="pe-fitting-mirror" aria-hidden="true">
                <div className="pe-fitting-mirror-frame">
                  <svg viewBox="0 0 200 300" fill="none">
                    <circle cx="100" cy="64" r="27" />
                    <path d="M53 135c4-25 21-37 47-37s43 12 47 37l12 77H41l12-77Z" />
                    <path d="m82 212-5 65m41-65 5 65M73 101l27 34 27-34m-27 34v77" />
                  </svg>
                  <span>Your portrait starts here</span>
                </div>
                <p>
                  From your photos.
                  <br />
                  Styled with your pieces.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="pe-fitting pe-fitting-studio min-h-full py-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="pe-fitting-studio-header max-w-2xl">
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
            className="pe-fitting-empty rounded-[22px] px-6 py-16 text-center shadow-[0_20px_60px_rgba(0,0,0,.18)]"
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
                  <div className="pe-fitting-portrait-shell max-w-3xl rounded-[22px] p-1 shadow-[0_24px_80px_rgba(0,0,0,.24)]">
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
