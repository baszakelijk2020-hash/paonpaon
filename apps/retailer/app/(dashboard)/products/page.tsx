import { ProductRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import Image from "next/image";
import Link from "next/link";

import { ProductStatusBadge } from "./status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ProductsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const products = await new ProductRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Products
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            {products.length} product{products.length === 1 ? "" : "s"} ·{" "}
            <Link href="/collections" className="underline">
              Collections
            </Link>
          </p>
        </div>
        <Link href="/products/new" className={buttonVariants()}>
          New product
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No products yet. Add the first one to start building your catalog.
          </p>
        </div>
      ) : (
        <ul
          aria-label="Product catalog"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/products/${product.id}`}
                className="group flex h-full min-h-44 flex-col overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-elevated)] transition duration-300 ease-[var(--ease-out-quiet)] hover:-translate-y-0.5 hover:border-[var(--color-stone-300)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-stone-900)] focus-visible:ring-offset-2"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-stone-100)]">
                  {product.primaryImageUrl ? (
                    <Image
                      src={product.primaryImageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
                      className="object-cover transition-transform duration-500 ease-[var(--ease-out-quiet)] group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.12em] text-[var(--color-stone-400)]">
                      No image
                    </div>
                  )}
                  <div className="absolute right-3 top-3">
                    <ProductStatusBadge status={product.status} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-5">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {product.name}
                  </p>
                  <p className="text-xs text-[var(--color-stone-500)]">
                    {product.slug}
                  </p>
                  {product.isMadeToOrder || product.isAlterable ? (
                    <p className="mt-auto pt-3 text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                      {[
                        product.isMadeToOrder ? "Made to order" : null,
                        product.isAlterable ? "Alterable" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
