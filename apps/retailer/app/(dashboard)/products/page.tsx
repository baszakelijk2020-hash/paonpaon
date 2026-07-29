import { ProductRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";

import { LowStockExportButton } from "./low-stock-export-button";
import { ProductsList } from "./products-list";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ProductsPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const products = await new ProductRepository(supabase).findByRetailer(
    session.retailerId,
  );
  const canExportLowStock = retailerRoleAtLeast(
    session.retailerRole,
    "manager",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap items-center gap-3">
          {canExportLowStock ? <LowStockExportButton /> : null}
          <Link href="/products/new" className={buttonVariants()}>
            New product
          </Link>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center">
          <p className="text-[var(--color-stone-600)]">
            No products yet. Add the first one to start building your catalogue.
          </p>
          <Link
            href="/products/new"
            className={buttonVariants({ className: "mt-6" })}
          >
            New product
          </Link>
        </div>
      ) : (
        <ProductsList products={products} />
      )}
    </div>
  );
}
