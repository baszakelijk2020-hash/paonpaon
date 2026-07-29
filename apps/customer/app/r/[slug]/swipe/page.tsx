import {
  CatalogueQueryRepository,
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

function decodeOccasionParam(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/-/g, " ").trim() || undefined;
}

export default async function SwipePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ occasion?: string }>;
}) {
  const { slug } = await params;
  const { occasion: occasionParam } = await searchParams;
  const occasionQuery = decodeOccasionParam(occasionParam);
  const session = await requireSession();

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  const productRepo = new ProductRepository(supabase);
  const variantRepo = new ProductVariantRepository(supabase);

  let productIdsInOrder: string[] = [];

  if (occasionQuery) {
    const search = await new CatalogueQueryRepository(supabase).search({
      retailerId: retailer.id,
      query: occasionQuery,
      sort: "relevance",
      page: 1,
      pageSize: 24,
    });
    productIdsInOrder = search.hits.map((hit) => hit.productId);
  }

  const products = (
    await productRepo.findByRetailer(retailer.id)
  ).filter((product) => product.status === "active");

  const filteredProducts =
    productIdsInOrder.length > 0
      ? productIdsInOrder
          .map((id) => products.find((product) => product.id === id))
          .filter((product): product is NonNullable<typeof product> => !!product)
      : products;

  const cards = (
    await Promise.all(
      filteredProducts.map(async (product) => {
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
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer.displayName}
        </p>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          {occasionQuery ? `Shortlist: ${occasionQuery}` : "Find your style"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Swipe right to save, left to skip.
          {occasionQuery
            ? " These pieces match accepted metadata for your occasion."
            : null}
        </p>
      </div>
      <SwipeDeck
        slug={slug}
        retailerId={retailer.id}
        cards={cards}
        savedVariantIds={savedVariantIds}
        {...(occasionQuery ? { occasionQuery } : {})}
      />
    </main>
  );
}
