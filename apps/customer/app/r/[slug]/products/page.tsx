import {
  CollectionRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TrackView } from "../track-view";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function StorefrontProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ collection?: string }>;
}) {
  const { slug } = await params;
  const { collection: collectionSlug } = await searchParams;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const collections = await new CollectionRepository(supabase).findByRetailer(
    retailer.id,
  );
  const activeCollection = collectionSlug
    ? collections.find((collection) => collection.slug === collectionSlug)
    : undefined;

  const allProducts = (
    await new ProductRepository(supabase).findByRetailer(retailer.id)
  ).filter((product) => product.status === "active");
  const products = activeCollection
    ? allProducts.filter((product) =>
        product.collectionIds.includes(activeCollection.id),
      )
    : allProducts;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      {activeCollection ? (
        <TrackView
          retailerId={retailer.id}
          name="category_browsed"
          properties={{
            collectionId: activeCollection.id,
            collectionName: activeCollection.name,
          }}
        />
      ) : null}
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
            {retailer.displayName}
          </p>
          <h1 className="text-4xl font-[var(--font-display)] text-[var(--color-stone-900)]">
            Shop
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/r/${slug}/swipe`}
            className="text-sm text-[var(--color-stone-700)] underline underline-offset-4"
          >
            Find your style
          </Link>
          <Link
            href={`/r/${slug}/appointments`}
            className="text-sm text-[var(--color-stone-700)] underline underline-offset-4"
          >
            Book an appointment
          </Link>
        </div>
      </div>

      {collections.length > 0 ? (
        <nav className="mb-10 flex flex-wrap gap-2">
          <Link
            href={`/r/${slug}/products`}
            className={`rounded-full border px-3 py-1 text-sm ${
              activeCollection
                ? "border-[var(--color-stone-300)] text-[var(--color-stone-600)]"
                : "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
            }`}
          >
            All
          </Link>
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/r/${slug}/products?collection=${collection.slug}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                activeCollection?.id === collection.id
                  ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-white"
                  : "border-[var(--color-stone-300)] text-[var(--color-stone-600)]"
              }`}
            >
              {collection.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {products.length === 0 ? (
        <p className="text-[var(--color-stone-600)]">
          {activeCollection
            ? "Nothing in this collection yet."
            : "Nothing available yet — check back soon."}
        </p>
      ) : (
        <div className="columns-2 gap-5 sm:columns-3 [&>*]:mb-5 [&>*]:break-inside-avoid">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/r/${slug}/products/${product.slug}`}
              className="group block"
            >
              <div className="mb-3 overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-100)]">
                {product.primaryImageUrl ? (
                  <Image
                    src={product.primaryImageUrl}
                    alt=""
                    width={480}
                    height={480}
                    unoptimized
                    className="w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quiet)] group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="aspect-[3/4] w-full" />
                )}
              </div>
              <p className="text-sm font-medium text-[var(--color-stone-900)]">
                {product.name}
              </p>
              {product.isMadeToOrder ? (
                <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                  Made to order
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
