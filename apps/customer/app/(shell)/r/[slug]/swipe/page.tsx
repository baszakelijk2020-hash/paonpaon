import { createHash } from "node:crypto";

import {
  AnalyticsRepository,
  CustomerRepository,
  ProductRepository,
  ProductVariantRepository,
  RetailerRepository,
  WishlistRepository,
} from "@paon/database";
import { asId, type ProductId } from "@paon/domain";
import { notFound } from "next/navigation";

import { SwipeDeck } from "./swipe-deck";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function parseProductIds(raw: string | undefined): ProductId[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        part,
      ),
    )
    .map((part) => asId<"ProductId">(part));
}

export default async function SwipePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ occasion?: string; products?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const session = await requireSession();
  const occasion = query.occasion?.trim();
  const shortlistIds = new Set(parseProductIds(query.products));

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") notFound();

  const products = (
    await new ProductRepository(supabase).findByRetailer(retailer.id)
  ).filter((product) => product.status === "active");

  const ordered =
    shortlistIds.size > 0
      ? [
          ...products.filter((product) => shortlistIds.has(product.id)),
          ...products.filter((product) => !shortlistIds.has(product.id)),
        ]
      : products;

  const variantRepo = new ProductVariantRepository(supabase);
  const cards = (
    await Promise.all(
      ordered.map(async (product) => {
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

  const deckVersion = createHash("sha256")
    .update(
      JSON.stringify({
        retailerId: retailer.id,
        occasion: occasion ?? null,
        selectionRule: "active-catalogue-v1",
        cards: cards.map((card) => ({
          productId: card.productId,
          variantId: card.variantId,
          name: card.name,
          imageUrl: card.imageUrl ?? null,
        })),
      }),
    )
    .digest("hex")
    .slice(0, 16);

  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = relationships.find(
    (item) => item.retailerId === retailer.id,
  );
  let savedVariantIds: string[] = [];
  const decidedProductIds = new Set<string>();
  if (customer) {
    const wishlistRepo = new WishlistRepository(supabase);
    const wishlist = await wishlistRepo.findByCustomer(customer.id);
    if (wishlist) {
      savedVariantIds = (await wishlistRepo.findItems(wishlist.id)).map(
        (item) => item.productVariantId,
      );
    }

    const events = await new AnalyticsRepository(supabase).findRecentByCustomer(
      retailer.id,
      customer.id,
      Math.min(Math.max(cards.length * 3, 50), 500),
    );
    for (const event of events) {
      if (
        (event.name === "product_favorited" ||
          event.name === "product_skipped") &&
        event.properties["via"] === "swipe" &&
        event.properties["deckVersion"] === deckVersion &&
        typeof event.properties["productId"] === "string"
      ) {
        decidedProductIds.add(event.properties["productId"]);
      }
    }
  }

  const savedSet = new Set(savedVariantIds);
  const initialLikedCards = cards.filter((card) =>
    savedSet.has(card.variantId),
  );
  const remainingCards = cards.filter(
    (card) =>
      !savedSet.has(card.variantId) && !decidedProductIds.has(card.productId),
  );

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col px-6 py-10">
      <div className="mb-6 text-center">
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer.displayName}
        </p>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          {occasion ? "Options for your occasion" : "Find your style"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          {occasion
            ? `Guided shortlist for ${occasion}. Swipe right to save, left to skip.`
            : "Swipe right to save, left to skip."}
        </p>
        <p className="mt-3 text-sm">
          <a
            className="text-[var(--color-stone-700)] underline"
            href={`/r/${slug}/appointments${occasion ? `?occasion=${encodeURIComponent(occasion)}` : ""}`}
          >
            Book an advisor to refine in store
          </a>
        </p>
      </div>
      <SwipeDeck
        slug={slug}
        retailerId={retailer.id}
        deckVersion={deckVersion}
        cards={remainingCards}
        savedVariantIds={savedVariantIds}
        initialLikedCards={initialLikedCards}
      />
    </main>
  );
}
