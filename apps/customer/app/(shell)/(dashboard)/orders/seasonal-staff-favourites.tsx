import {
  MicroCapsuleRepository,
  ProductRepository,
  ProductVariantRepository,
} from "@paon/database";
import type { RetailerId } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { getSupabaseServerClient } from "@/lib/supabase-server";

interface FavouritePiece {
  readonly productId: string;
  readonly slug: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly priceLabel?: string;
}

/**
 * §7 "seasonal staff favourites" supporting module. This is the retailer's
 * own existing MicroCapsule / Capsule Drop system (same repository,
 * `/capsule` page, and retailer `capsule-drops` control) rendered
 * compactly on Orders — never a second selection engine, never a
 * fabricated staff identity or campaign. The retailer's currently
 * published drop is the sole source of truth; its `findProductsForDrop`
 * rank order is preserved exactly. Only active, non-deleted, same-retailer
 * products are shown — `ProductRepository.findById` already excludes
 * soft-deleted rows, and `status === "active"` is checked explicitly here,
 * matching the same real-route gate the Wardrobe reorder link uses.
 *
 * `excludeProductIds` de-dupes against whichever real product IDs another
 * Orders module on the same viewport already shows (Complete the Look's
 * source + suggestions) — that module keeps its full real set; this one
 * simply omits any product it already listed, per §7's no-duplication rule.
 */
export async function SeasonalStaffFavourites({
  retailerId,
  retailerSlug,
  excludeProductIds,
}: {
  retailerId: RetailerId;
  retailerSlug: string;
  excludeProductIds: ReadonlySet<string>;
}) {
  const supabase = await getSupabaseServerClient();
  const dropRepo = new MicroCapsuleRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);

  const drop = await dropRepo.findCurrentPublished(retailerId);
  if (!drop) return null;

  const dropProducts = await dropRepo.findProductsForDrop(drop.id);
  const resolved = await Promise.all(
    dropProducts.map(async (dropProduct) => {
      const product = await productRepo.findById(dropProduct.productId);
      if (!product || product.status !== "active") return null;
      if (excludeProductIds.has(product.id)) return null;
      const variants = await variantRepo.findByProduct(product.id);
      const piece: FavouritePiece = {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        ...(product.primaryImageUrl
          ? { imageUrl: product.primaryImageUrl }
          : {}),
        ...(variants[0]
          ? { priceLabel: formatMoney(variants[0].price, "en-US") }
          : {}),
      };
      return piece;
    }),
  );
  const pieces = resolved.filter(
    (piece): piece is FavouritePiece => piece !== null,
  );
  if (pieces.length === 0) return null;

  return (
    <section
      id="orders-seasonal-favourites"
      aria-labelledby="orders-seasonal-favourites-heading"
    >
      <p
        id="orders-seasonal-favourites-heading"
        className="customer-kicker mb-3 text-[var(--color-stone-500)]"
      >
        Seasonal staff favourites
      </p>
      <div className="border-y border-[var(--customer-border)] py-6">
        <p className="mb-4 text-center text-sm font-medium text-[var(--color-stone-900)]">
          {drop.title}
        </p>
        {drop.theme ? (
          <p className="-mt-3 mb-4 text-center text-xs text-[var(--color-stone-500)]">
            {drop.theme}
          </p>
        ) : null}
        <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
          {pieces.map((piece) => (
            <li key={piece.productId} className="shrink-0 snap-start">
              <Link
                href={`/r/${retailerSlug}/products/${piece.slug}?legacy=1`}
                className="flex w-32 flex-col gap-2"
              >
                <span className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-[15px] bg-[var(--color-stone-900)]">
                  {piece.imageUrl ? (
                    <>
                      {/* Restrained blurred backing layer only — never
                          plain empty letterboxing — while the full
                          original image stays primary via object-contain
                          below (contract §5.3's owned-card treatment,
                          reused here for the same real-imagery rule). */}
                      <Image
                        src={piece.imageUrl}
                        alt=""
                        fill
                        unoptimized
                        aria-hidden="true"
                        className="scale-110 object-cover opacity-50 blur-xl"
                      />
                      <Image
                        src={piece.imageUrl}
                        alt={piece.name}
                        fill
                        unoptimized
                        className="object-contain"
                      />
                    </>
                  ) : (
                    <span className="px-2 text-center text-[10px] text-[var(--color-stone-300)]">
                      {piece.name}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 text-xs text-[var(--color-stone-700)]">
                  {piece.name}
                </span>
                {piece.priceLabel ? (
                  <span className="text-xs text-[var(--color-stone-500)]">
                    {piece.priceLabel}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center">
          <Link
            href="/capsule"
            className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone-600)] underline underline-offset-4"
          >
            View the full capsule
          </Link>
        </p>
      </div>
    </section>
  );
}
