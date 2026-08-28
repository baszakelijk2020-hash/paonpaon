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

interface CapsulePiece {
  readonly slug: string;
  readonly name: string;
  readonly imageUrl?: string;
  readonly priceLabel?: string;
}

/**
 * Dashboard's compact surface for the retailer's real, already-published
 * Capsule Drop (same `MicroCapsuleRepository` + `ProductRepository` data
 * path as `/capsule` — this never introduces a second selection system).
 * Real products only, in their real stored rank order; no fabricated
 * price, availability, or staff identity. Renders nothing at all when the
 * retailer has no currently published drop — this is a surface for real
 * data, not a slot that must always show something.
 */
export async function SeasonalCapsuleStrip({
  retailerId,
  retailerSlug,
}: {
  retailerId: RetailerId;
  retailerSlug: string;
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
      if (!product) return null;
      const variants = await variantRepo.findByProduct(product.id);
      const piece: CapsulePiece = {
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
    (piece): piece is CapsulePiece => piece !== null,
  );
  if (pieces.length === 0) return null;

  return (
    <section className="bg-[var(--customer-paper)] px-7 py-12 sm:px-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="customer-kicker text-[var(--color-stone-500)]">
            Seasonal selection
          </p>
          <h2 className="font-display mt-2 text-2xl text-[var(--color-stone-900)]">
            {drop.title}
          </h2>
          {drop.theme ? (
            <p className="mt-1 text-sm text-[var(--color-stone-500)]">
              {drop.theme}
            </p>
          ) : null}
        </div>
        <Link
          href="/capsule"
          className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-stone-600)] underline underline-offset-4"
        >
          View the full capsule
        </Link>
      </div>
      <div className="-mx-7 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-7 pb-2 sm:-mx-12 sm:px-12">
        {pieces.map((piece) => (
          <Link
            key={piece.slug}
            href={`/r/${retailerSlug}/products/${piece.slug}`}
            className="group relative h-72 w-52 shrink-0 snap-start overflow-hidden rounded-[15px] bg-[var(--color-stone-900)]"
          >
            {piece.imageUrl ? (
              <Image
                src={piece.imageUrl}
                alt={piece.name}
                fill
                unoptimized
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : null}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-4 pb-4 pt-10">
              <p className="line-clamp-2 text-sm font-medium text-white">
                {piece.name}
              </p>
              {piece.priceLabel ? (
                <p className="mt-0.5 text-xs text-white/75">
                  {piece.priceLabel}
                </p>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
