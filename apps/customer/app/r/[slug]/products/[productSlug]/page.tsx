import {
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  WishlistRepository,
} from "@paon/database";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrderForm } from "./order-form";
import { WishlistToggle } from "./wishlist-toggle";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StorefrontProductPage({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}) {
  const { slug, productSlug } = await params;
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link
        href={`/r/${slug}/products`}
        className="mb-6 inline-block text-sm text-[var(--color-stone-500)] hover:underline"
      >
        ← Back to {retailer.displayName}
      </Link>
      {product.primaryImageUrl ? (
        <Image
          src={product.primaryImageUrl}
          alt={product.name}
          width={640}
          height={640}
          unoptimized
          className="mb-6 aspect-square w-full rounded-[var(--radius-md)] object-cover"
        />
      ) : null}
      <h1 className="mb-2 text-2xl font-medium text-[var(--color-stone-900)]">
        {product.name}
      </h1>
      {product.description ? (
        <p className="mb-6 text-[var(--color-stone-700)]">
          {product.description}
        </p>
      ) : null}
      {product.isMadeToOrder ? (
        <p className="mb-6 text-sm text-[var(--color-stone-500)]">
          Made to order
        </p>
      ) : null}

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
    </main>
  );
}
