import {
  CustomerRepository,
  RetailerRepository,
  TieMateRepository,
  WishlistRepository,
} from "@paon/database";
import {
  buildTieMateActionPaths,
  type ProductId,
  type TieMateFabricCard,
} from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TieMateDeck, type TieMateDeckCard } from "./tie-mate-deck";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function toDeckCard(
  slug: string,
  card: TieMateFabricCard,
  productIds: readonly ProductId[],
): TieMateDeckCard {
  const paths = buildTieMateActionPaths({
    slug,
    productSlug: card.productSlug,
    productId: card.productId,
    productIdsForSwipe: productIds,
  });

  return {
    productId: card.productId,
    productSlug: card.productSlug,
    name: card.name,
    variantId: card.variantId,
    price: card.price,
    inventoryQuantity: card.inventoryQuantity,
    inStock: card.inStock,
    fabricImageUrl: card.fabricImageUrl,
    fabricPhotoRole: card.fabricPhotoRole,
    productPath: paths.productPath,
    orderPath: paths.orderPath,
    appointmentPath: paths.appointmentPath,
    messagesPath: paths.messagesPath,
    swipeHandoffPath: paths.swipeHandoffPath,
  };
}

export default async function TieMatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [supabase, session] = await Promise.all([
    getSupabaseServerClient(),
    getSession(),
  ]);

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const deck = await new TieMateRepository(supabase).buildDeck({
    retailerId: retailer.id,
    slug,
  });

  const productIds = deck.cards.map((card) => card.productId);
  const cards = deck.cards.map((card) => toDeckCard(slug, card, productIds));

  const isSignedIn = !!session && session.accountType === "customer";
  let savedVariantIds: string[] = [];
  if (isSignedIn && session) {
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

  if (cards.length === 0) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-center gap-4 px-6 py-10">
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          {retailer.displayName}
        </p>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Tie-Mate
        </h1>
        <p className="text-sm text-[var(--color-stone-600)]">
          No neckwear fabrics are ready for phone-scale try-on yet. Ties need an
          accepted neckwear garment type, live stock (or made-to-order), and a
          sharp fabric close-up on the swatch image.
        </p>
        {(deck.skippedWithoutPhoto > 0 ||
          deck.skippedOutOfStock > 0 ||
          deck.skippedNotTie > 0) && (
          <p className="text-xs text-[var(--color-stone-500)]">
            Skipped in this catalogue: {deck.skippedNotTie} not neckwear,{" "}
            {deck.skippedWithoutPhoto} without a fabric photo,{" "}
            {deck.skippedOutOfStock} out of stock.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/r/${slug}`} className={buttonVariants({ size: "sm" })}>
            Browse the shop
          </Link>
          <Link
            href={`/r/${slug}/appointments?occasion=${encodeURIComponent("Tie-Mate fabric exploration")}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ask an advisor
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <TieMateDeck
        slug={slug}
        retailerId={retailer.id}
        retailerName={retailer.displayName}
        cards={cards}
        savedVariantIds={savedVariantIds}
        isSignedIn={isSignedIn}
      />
    </main>
  );
}
