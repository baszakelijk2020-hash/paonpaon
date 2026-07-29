"use client";

import type { Product } from "@paon/domain";
import { SearchableCollection } from "@paon/ui/components/SearchableCollection";
import Image from "next/image";
import Link from "next/link";

import { ProductStatusBadge } from "./status-badge";

export function ProductsList({ products }: { products: Product[] }) {
  return (
    <SearchableCollection
      items={products}
      placeholder="Search product name or slug…"
      label="Search products"
      predicate={(product, query) =>
        product.name.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query)
      }
      empty={
        <p className="text-sm text-[var(--color-stone-500)]">
          No products match that search.
        </p>
      }
    >
      {(filtered) => (
        <ul
          aria-label="Product catalog"
          className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((product) => (
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
    </SearchableCollection>
  );
}
