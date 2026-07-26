import type { Product, ProductVariant } from "@paon/domain";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";

import { ProductVariantSelector } from "./product-variant-selector";

/**
 * paon.html's `.detail-right` — a fixed 500px right-hand panel over the
 * grid (not a route change, not a modal dialog) with a dark
 * `linear-gradient(to right, #595959, #000)` body, a beige image well,
 * and a white footer strip holding the fabric/material selector. Ported
 * as a Server Component reading `?p=slug` from the parent page so the
 * panel state is a real, shareable URL rather than client-only state.
 */
export function ProductDetailPanel({
  slug,
  retailerId,
  product,
  variants,
}: {
  slug: string;
  retailerId: string;
  product: Product;
  variants: readonly ProductVariant[];
}) {
  const prices = variants.map((v) => v.price.amountMinorUnits);
  const priceLabel =
    variants.length === 0
      ? null
      : prices.every((amount) => amount === prices[0])
        ? formatMoney(variants[0]!.price, "en-US")
        : `From ${formatMoney(
            variants.reduce((lowest, variant) =>
              variant.price.amountMinorUnits < lowest.price.amountMinorUnits
                ? variant
                : lowest,
            ).price,
            "en-US",
          )}`;

  return (
    <div className="fixed inset-0 z-[80] lg:inset-y-0 lg:left-auto lg:right-0 lg:w-[500px]">
      <Link
        href={`/r/${slug}`}
        aria-label="Close"
        className="absolute inset-0 bg-black/40 lg:hidden"
        scroll={false}
      />
      <div className="relative flex h-full flex-col bg-[linear-gradient(to_right,#595959,#000)]">
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-white/10 px-5">
          <p className="text-xs uppercase tracking-[0.15em] text-white/50">
            {product.isMadeToOrder ? "Custom made" : "In atelier"}
          </p>
          <Link
            href={`/r/${slug}`}
            aria-label="Close"
            scroll={false}
            className="flex h-8 w-8 items-center justify-center text-lg text-white/60 hover:text-white"
          >
            ×
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="aspect-[1168/2247] w-full bg-[#e8e3dc]">
            {product.primaryImageUrl ? (
              <Image
                src={product.primaryImageUrl}
                alt={product.name}
                width={584}
                height={1124}
                unoptimized
                priority
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <div className="pr-15 px-5 py-5">
            <h2 className="mb-2 text-xl leading-snug text-[#bfbfbf]">
              {product.name}
            </h2>
            {priceLabel ? (
              <p className="mb-3 text-sm text-white/40">{priceLabel}</p>
            ) : null}
            <p className="max-w-[375px] text-base leading-relaxed text-[#808080]">
              {product.description}
            </p>
          </div>
        </div>

        <div className="shrink-0 bg-white px-5 pb-6 pt-5">
          {variants.length > 0 ? (
            <ProductVariantSelector
              slug={slug}
              productSlug={product.slug}
              retailerId={retailerId}
              variants={variants}
            />
          ) : (
            <p className="text-sm text-[var(--color-stone-500)]">
              Not currently available.
            </p>
          )}
          <Link
            href={`/r/${slug}/products/${product.slug}`}
            className="mt-3 block text-center text-xs text-[var(--color-stone-500)] underline underline-offset-4"
          >
            View full details
          </Link>
        </div>
      </div>
    </div>
  );
}
