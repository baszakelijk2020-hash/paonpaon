import { ProductRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
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
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
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
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.id}`}
              className="flex items-center justify-between px-6 py-4 hover:bg-[var(--color-stone-50)]"
            >
              <div>
                <p className="font-medium text-[var(--color-stone-900)]">
                  {product.name}
                </p>
                <p className="text-sm text-[var(--color-stone-500)]">
                  {product.slug}
                  {product.isMadeToOrder ? " · Made to order" : ""}
                  {product.isAlterable ? " · Alterable" : ""}
                </p>
              </div>
              <ProductStatusBadge status={product.status} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
