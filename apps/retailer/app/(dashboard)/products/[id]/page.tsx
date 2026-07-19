import { ProductRepository, ProductVariantRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import { notFound } from "next/navigation";

import { ProductStatusBadge } from "../status-badge";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const product = await new ProductRepository(supabase).findById(
    asId<"ProductId">(id),
  );

  if (!product) {
    notFound();
  }

  const variants = await new ProductVariantRepository(supabase).findByProduct(
    product.id,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
            {product.name}
          </h1>
          <ProductStatusBadge status={product.status} />
        </div>
        <p className="text-sm text-[var(--color-stone-500)]">
          {product.slug}
          {product.isMadeToOrder ? " · Made to order" : ""}
          {product.isAlterable ? " · Alterable" : ""}
        </p>
        {product.description ? (
          <p className="mt-2 text-sm text-[var(--color-stone-700)]">
            {product.description}
          </p>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Variants
        </h2>
        <Card className="divide-y divide-[var(--color-stone-100)] p-0">
          {variants.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-stone-500)]">
              No variants yet.
            </p>
          ) : (
            variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {variant.sku}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {[variant.size, variant.color]
                      .filter(Boolean)
                      .join(" · ") || "No size/color set"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {formatMoney(variant.price, "en-US")}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {variant.inventoryQuantity} in stock
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
