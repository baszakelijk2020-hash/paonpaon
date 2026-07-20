import {
  CollectionRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
        {retailer.displayName}
      </p>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Shop
        </h1>
        <Link href={`/r/${slug}/appointments`} className="text-sm underline">
          Book an appointment
        </Link>
      </div>

      {collections.length > 0 ? (
        <nav className="mb-6 flex flex-wrap gap-2">
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
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/r/${slug}/products/${product.slug}`}
              className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              {product.primaryImageUrl ? (
                <Image
                  src={product.primaryImageUrl}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="aspect-square w-14 shrink-0 rounded-[var(--radius-sm)] object-cover"
                />
              ) : null}
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {product.name}
                </p>
                {product.isMadeToOrder ? (
                  <p className="text-sm text-[var(--color-stone-500)]">
                    Made to order
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </main>
  );
}
