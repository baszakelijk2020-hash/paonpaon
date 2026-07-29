import {
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  WishlistRepository,
} from "@paon/database";
import { formatMoney } from "@paon/utils";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TrackView } from "../../track-view";

import { OrderForm } from "./order-form";
import { WishlistToggle } from "./wishlist-toggle";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Canonical shopping is the founder HTML storefront (`/r/[slug]`, ADR-052).
 * This React PDP redirects there so prospects never land on a plainer twin.
 * `?legacy=1` keeps the page for e2e / rare signed-in action targets only.
 */
export default async function StorefrontProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ legacy?: string }>;
}) {
  const { slug, productSlug } = await params;
  const { legacy } = await searchParams;
  if (legacy !== "1") {
    redirect(`/r/${slug}`);
  }

  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const product = await new ProductRepository(supabase).findBySlug(
    retailer.id,
    productSlug,
  );
  if (!product || product.status !== "active") {
    notFound();
  }

  const variants = await new ProductVariantRepository(supabase).findByProduct(
    product.id,
  );
  const session = await getSession();
  const isSignedIn = !!session && session.accountType === "customer";

  let savedVariantIds: string[] = [];
  if (isSignedIn) {
    const relationships = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = relationships.find(
      (item) => item.retailerId === retailer.id,
    );
    if (customer) {
      const wishlistRepo = new WishlistRepository(supabase);
      const wishlist = await wishlistRepo.findByCustomer(customer.id);
      if (wishlist) {
        savedVariantIds = (await wishlistRepo.findItems(wishlist.id)).map(
          (item) => item.productVariantId,
        );
      }
    }
  }

  const prices = variants.map((variant) => variant.price.amountMinorUnits);
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
    <main className="mx-auto max-w-5xl px-6 py-10">
      <TrackView
        retailerId={retailer.id}
        name="product_viewed"
        properties={{ productId: product.id, productName: product.name }}
      />
      <Link
        href={`/r/${slug}`}
        className="mb-8 inline-block text-sm text-[var(--color-stone-500)] hover:underline"
      >
        ← Back to {retailer.displayName}
      </Link>

      <div className="mb-6 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] px-4 py-3 text-sm text-[var(--color-stone-600)]">
        Legacy action page for signed-in cart and wishlist flows.{" "}
        <Link
          href={`/r/${slug}`}
          className="font-medium text-[var(--color-stone-900)] underline underline-offset-4"
        >
          Open the full storefront
        </Link>{" "}
        for the primary shopping experience.
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="paon-reveal lg:sticky lg:top-10 lg:self-start">
          {product.primaryImageUrl ? (
            <Image
              src={product.primaryImageUrl}
              alt={product.name}
              width={800}
              height={800}
              unoptimized
              priority
              className="aspect-square w-full rounded-[var(--radius-md)] object-cover"
            />
          ) : (
            <div className="aspect-square w-full rounded-[var(--radius-md)] bg-[var(--color-stone-100)]" />
          )}
        </div>

        <div className="paon-reveal" style={{ animationDelay: "120ms" }}>
          {product.isMadeToOrder ? (
            <p className="font-accent mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
              Made to order
            </p>
          ) : null}
          <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
            {product.name}
          </h1>
          {priceLabel ? (
            <p className="mt-2 text-lg text-[var(--color-stone-700)]">
              {priceLabel}
            </p>
          ) : null}
          {product.description ? (
            <p className="mt-5 text-[var(--color-stone-700)]">
              {product.description}
            </p>
          ) : null}

          <div className="mt-8 border-t border-[var(--color-stone-200)] pt-8">
            {variants.length === 0 ? (
              <p className="text-[var(--color-stone-600)]">
                Not currently available.
              </p>
            ) : (
              <>
                <OrderForm
                  slug={slug}
                  productSlug={productSlug}
                  retailerId={retailer.id}
                  variants={variants}
                  isSignedIn={isSignedIn}
                  isMadeToOrder={product.isMadeToOrder}
                />
                {isSignedIn ? (
                  <WishlistToggle
                    slug={slug}
                    productSlug={productSlug}
                    retailerId={retailer.id}
                    variants={variants}
                    savedVariantIds={savedVariantIds}
                  />
                ) : null}
              </>
            )}
          </div>

          <div className="mt-6 border-t border-[var(--color-stone-200)] pt-6">
            <p className="text-sm text-[var(--color-stone-600)]">
              Prefer to try it on first?{" "}
              <Link
                href={`/r/${slug}`}
                className="underline underline-offset-4"
              >
                Book a complimentary fitting in the storefront
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
