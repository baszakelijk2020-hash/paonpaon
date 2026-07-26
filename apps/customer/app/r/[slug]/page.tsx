import {
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
} from "@paon/database";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductDetailPanel } from "./product-detail-panel";
import { StorefrontNav } from "./storefront-nav";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * paon.html's real home: a 3-column masonry grid of the full catalogue
 * (`.home-masonry-grid`), tall portrait cards with a bottom-left
 * name/price caption, a 900ms scale+brightness hover, opening a fixed
 * 500px right-hand product panel (`.detail-right`) on click rather than
 * navigating away — ported pixel-for-pixel from the founder's own
 * source file (measured directly: `--image-ratio: 1168 / 2247`,
 * `#808080` caption text, `linear-gradient(to right, #595959, #000)`
 * panel body), not the earlier "Munro Mark-II"-inspired scroll-snap
 * hero this replaced.
 */
export default async function StorefrontLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { slug } = await params;
  const { p: selectedSlug } = await searchParams;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const productRepo = new ProductRepository(supabase);
  const allProducts = await productRepo.findByRetailer(retailer.id);
  const products = allProducts.filter((product) => product.status === "active");

  const variantRepo = new ProductVariantRepository(supabase);
  const cards = await Promise.all(
    products.map(async (product) => {
      const variants = await variantRepo.findByProduct(product.id);
      const prices = variants.map((v) => v.price.amountMinorUnits);
      const priceLabel =
        variants.length === 0
          ? null
          : prices.every((amount) => amount === prices[0])
            ? variants[0]!.price
            : variants.reduce((lowest, variant) =>
                variant.price.amountMinorUnits < lowest.price.amountMinorUnits
                  ? variant
                  : lowest,
              ).price;
      return { product, variants, priceLabel };
    }),
  );

  const selected = selectedSlug
    ? cards.find((card) => card.product.slug === selectedSlug)
    : undefined;

  return (
    <>
      <main className="px-2 py-2 pb-20 lg:px-4 lg:pb-4 lg:pt-20">
        {cards.length === 0 ? (
          <p className="px-4 py-16 text-center text-[var(--color-stone-500)]">
            Nothing available yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:gap-1.5">
            {cards.map(({ product, priceLabel }) => (
              <Link
                key={product.id}
                href={`/r/${slug}?p=${product.slug}`}
                scroll={false}
                className="group relative block aspect-[1168/2247] overflow-hidden bg-[#e8e3dc]"
              >
                {product.primaryImageUrl ? (
                  <Image
                    src={product.primaryImageUrl}
                    alt=""
                    width={584}
                    height={1124}
                    unoptimized
                    className="h-full w-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(.19,.74,.31,1)] group-hover:scale-[1.02] group-hover:brightness-[1.01] group-hover:saturate-[1.02]"
                  />
                ) : null}
                <div className="absolute bottom-3 left-3 text-xs leading-tight text-[#808080] [text-shadow:0_1px_2px_rgba(255,255,255,.6)]">
                  <p>{product.name}</p>
                  {priceLabel ? (
                    <p>
                      {priceLabel.currency}{" "}
                      {(priceLabel.amountMinorUnits / 100).toFixed(0)}
                    </p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {selected ? (
        <ProductDetailPanel
          slug={slug}
          retailerId={retailer.id}
          product={selected.product}
          variants={selected.variants}
        />
      ) : null}

      <StorefrontNav slug={slug} retailerName={retailer.displayName} />
    </>
  );
}
