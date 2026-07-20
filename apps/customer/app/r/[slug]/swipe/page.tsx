import {
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  WishlistRepository,
} from "@paon/database";
import { notFound } from "next/navigation";

import { SwipeDeck } from "./swipe-deck";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function SwipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await requireSession();

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  const products = (
    await new ProductRepository(supabase).findByRetailer(retailer.id)
  ).filter((product) => product.status === "active");

  const variantRepo = new ProductVariantRepository(supabase);
  const cards = (
    await Promise.all(
      products.map(async (product) => {
        const variants = await variantRepo.findByProduct(product.id);
        const variant = variants[0];
        return variant
          ? {
              productId: product.id,
              productSlug: product.slug,
              name: product.name,
              ...(product.primaryImageUrl
                ? { imageUrl: product.primaryImageUrl }
                : {}),
              variantId: variant.id,
              price: variant.price,
            }
          : null;
      }),
    )
  ).filter((card): card is NonNullable<typeof card> => !!card);

  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = relationships.find(
    (item) => item.retailerId === retailer.id,
  );
  let savedVariantIds: string[] = [];
  if (customer) {
    const wishlistRepo = new WishlistRepository(supabase);
    const wishlist = await wishlistRepo.findByCustomer(customer.id);
    if (wishlist) {
      savedVariantIds = (await wishlistRepo.findItems(wishlist.id)).map(
        (item) => item.productVariantId,
      );
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col px-6 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer.displayName}
        </p>
        <h1 className="text-3xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Find your style
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Swipe right to save, left to skip.
        </p>
      </div>
      <SwipeDeck
        slug={slug}
        retailerId={retailer.id}
        cards={cards}
        savedVariantIds={savedVariantIds}
      />
    </main>
  );
}
