import {
  CollectionRepository,
  ProductRepository,
  RetailerRepository,
} from "@paon/database";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StorefrontNav } from "./storefront-nav";

import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * The mobile-first entry point pattern from the founder's landing-page
 * reference (scroll-snap full-height sections, sticky bottom nav bar,
 * horizontal carousels, vertical slide-out menu) — rebuilt with PAON's
 * own copy and structure. No real hero video/photography exists yet, so
 * every "video" section is a decorative gradient placeholder rather than
 * a stand-in third-party asset; swap in real media when the founder
 * supplies it.
 */
export default async function StorefrontLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();

  const retailer = await new RetailerRepository(supabase).findBySlug(slug);
  if (!retailer || retailer.status !== "active") {
    notFound();
  }

  const [collections, allProducts] = await Promise.all([
    new CollectionRepository(supabase).findByRetailer(retailer.id),
    new ProductRepository(supabase).findByRetailer(retailer.id),
  ]);
  const products = allProducts.filter((product) => product.status === "active");
  const featured = products.slice(0, 10);

  const collectionsWithCover = collections.map((collection) => ({
    collection,
    coverImageUrl: products.find((product) =>
      product.collectionIds.includes(collection.id),
    )?.primaryImageUrl,
  }));

  return (
    <>
      <main className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll scroll-smooth pb-16">
        <section className="relative flex h-[100dvh] snap-start flex-col items-center justify-center overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(155deg,var(--retailer-ink,#1a1a1a)_0%,var(--retailer-accent,#3a3a3a)_55%,var(--retailer-ink,#1a1a1a)_100%)]"
          />
          <div className="relative flex flex-col items-center gap-4 px-6 text-center text-white">
            <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.3em] text-white/70">
              {retailer.displayName}
            </p>
            <h1 className="text-4xl font-[var(--font-retailer-display,var(--font-display))] sm:text-6xl">
              Made to measure.
              <br />
              Made to matter.
            </h1>
            <Link
              href={`/r/${slug}/products`}
              className="mt-4 rounded-full bg-white px-8 py-3 text-sm font-medium text-black"
            >
              Enter the atelier
            </Link>
          </div>
          <span
            aria-hidden="true"
            className="absolute bottom-8 text-xs uppercase tracking-[0.2em] text-white/50"
          >
            Scroll
          </span>
        </section>

        {collectionsWithCover.length > 0 ? (
          <section className="flex h-[100dvh] snap-start flex-col justify-center gap-6 px-6 py-10">
            <div>
              <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                Collections
              </p>
              <h2 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
                Choose your world
              </h2>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
              {collectionsWithCover.map(({ collection, coverImageUrl }) => (
                <Link
                  key={collection.id}
                  href={`/r/${slug}/products?collection=${collection.slug}`}
                  className="group relative flex h-72 w-56 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-stone-100)]"
                >
                  {coverImageUrl ? (
                    <Image
                      src={coverImageUrl}
                      alt=""
                      width={400}
                      height={560}
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quiet)] group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-[linear-gradient(165deg,var(--color-stone-300)_0%,var(--color-stone-100)_100%)]"
                    />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"
                  />
                  <p className="relative px-4 pb-4 text-lg font-[var(--font-display)] text-white">
                    {collection.name}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {featured.length > 0 ? (
          <section className="flex min-h-[100dvh] snap-start flex-col justify-center gap-6 px-6 py-10">
            <div>
              <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                Featured
              </p>
              <h2 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
                New this season
              </h2>
            </div>
            <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
              {featured.map((product) => (
                <Link
                  key={product.id}
                  href={`/r/${slug}/products/${product.slug}`}
                  className="group w-40 shrink-0 snap-start"
                >
                  <div className="mb-2 aspect-[3/4] overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-stone-100)]">
                    {product.primaryImageUrl ? (
                      <Image
                        src={product.primaryImageUrl}
                        alt=""
                        width={320}
                        height={420}
                        unoptimized
                        className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-out-quiet)] group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="h-full w-full bg-[linear-gradient(165deg,var(--color-stone-200)_0%,var(--color-stone-50)_100%)]"
                      />
                    )}
                  </div>
                  <p className="text-sm font-medium text-[var(--color-stone-900)]">
                    {product.name}
                  </p>
                </Link>
              ))}
            </div>
            <Link
              href={`/r/${slug}/products`}
              className="text-sm text-[var(--color-stone-700)] underline underline-offset-4"
            >
              Shop the full collection
            </Link>
          </section>
        ) : null}

        <section className="relative flex h-[100dvh] snap-start flex-col items-center justify-center overflow-hidden text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(155deg,var(--color-stone-900)_0%,var(--retailer-accent,#3a3a3a)_100%)]"
          />
          <div className="relative flex flex-col items-center gap-4 px-6 text-white">
            <p className="text-xs font-[var(--font-accent)] font-medium uppercase tracking-[0.3em] text-white/70">
              By appointment
            </p>
            <h2 className="text-3xl font-[var(--font-retailer-display,var(--font-display))] sm:text-4xl">
              A fitting, on your time.
            </h2>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Link
                href={`/r/${slug}/appointments`}
                className="rounded-full bg-white px-8 py-3 text-sm font-medium text-black"
              >
                Book an appointment
              </Link>
              <Link
                href={`/r/${slug}/swipe`}
                className="rounded-full border border-white/40 px-8 py-3 text-sm font-medium text-white"
              >
                Find your style
              </Link>
            </div>
          </div>
        </section>
      </main>

      <StorefrontNav slug={slug} />
    </>
  );
}
