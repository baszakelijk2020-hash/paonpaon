import { requireRetailerRole } from "@paon/auth";
import {
  CollectionRepository,
  ProductRepository,
  ProductVariantRepository,
} from "@paon/database";
import { asId } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { ProductStatusBadge } from "../status-badge";

import { ProductEditor, VariantEditor } from "./catalogue-editor";
import { ProductImageUploader } from "./product-image-uploader";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
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
  const collections = await new CollectionRepository(supabase).findByRetailer(
    session.retailerId,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
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

      <ProductImageUploader
        productId={product.id}
        {...(product.primaryImageUrl
          ? { imageUrl: product.primaryImageUrl }
          : {})}
      />

      <ProductEditor product={product} collections={collections} />

      <div>
        <h2 className="mb-3 text-lg font-medium text-[var(--color-stone-900)]">
          Variants
        </h2>
        <div className="flex flex-col gap-3">
          {variants.length === 0 ? (
            <Card>
              <p className="text-sm text-[var(--color-stone-500)]">
                No variants yet.
              </p>
            </Card>
          ) : (
            variants.map((variant) => (
              <VariantEditor key={variant.id} variant={variant} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
