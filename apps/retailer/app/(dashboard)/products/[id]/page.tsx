import { requireRetailerRole } from "@paon/auth";
import {
  CollectionRepository,
  MetadataRepository,
  ProductFabricProfileRepository,
  ProductRepository,
  ProductVariantRepository,
} from "@paon/database";
import { asId, type EntityMetadataAssignment } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { notFound } from "next/navigation";

import { ProductStatusBadge } from "../status-badge";

import { ProductEditor, VariantEditor } from "./catalogue-editor";
import {
  ProductCatalogueAssignments,
  ProductFabricEditor,
  VariantFabricEditor,
} from "./product-facts-editor";
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

  const metadata = new MetadataRepository(supabase);
  const fabricRepo = new ProductFabricProfileRepository(supabase);
  const [variants, collections, concepts, productAssignments, productFabric] =
    await Promise.all([
      new ProductVariantRepository(supabase).findByProduct(product.id),
      new CollectionRepository(supabase).findByRetailer(session.retailerId),
      metadata.findVisibleConcepts(session.retailerId),
      metadata.findAssignmentsForTarget(session.retailerId, {
        targetType: "product",
        targetId: product.id,
      }),
      fabricRepo.findForProduct(session.retailerId, product.id),
    ]);

  const fibreConcepts = concepts.filter((concept) => concept.kind === "fibre");
  const variantAssignments = await Promise.all(
    variants.map(async (variant) => {
      const [assignments, fabric] = await Promise.all([
        metadata.findAssignmentsForTarget(session.retailerId, {
          targetType: "product_variant",
          targetId: variant.id,
        }),
        fabricRepo.findForVariant(session.retailerId, product.id, variant.id),
      ]);
      return { variant, assignments, fabric };
    }),
  );

  const assignmentsByVariantId = new Map<
    string,
    readonly EntityMetadataAssignment[]
  >(
    variantAssignments.map(({ variant, assignments }) => [
      variant.id,
      assignments,
    ]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
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

      <ProductFabricEditor
        productId={product.id}
        profile={productFabric}
        fibreConcepts={fibreConcepts}
      />

      <ProductCatalogueAssignments
        productId={product.id}
        concepts={concepts}
        productAssignments={productAssignments}
        variants={variants}
        assignmentsByVariantId={assignmentsByVariantId}
      />

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

      {variantAssignments.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
            Variant fabric overrides
          </h2>
          <p className="text-sm text-[var(--color-stone-500)]">
            Leave these empty unless a size, colour, or SKU genuinely has
            different fabric facts.
          </p>
          {variantAssignments.map(({ variant, fabric }) => (
            <VariantFabricEditor
              key={variant.id}
              productId={product.id}
              variant={variant}
              profile={fabric}
              fibreConcepts={fibreConcepts}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
