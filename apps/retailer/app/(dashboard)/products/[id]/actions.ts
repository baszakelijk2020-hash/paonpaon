"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  ProductRepository,
  ProductSlugAlreadyExistsError,
  ProductVariantRepository,
  VariantSkuAlreadyExistsError,
} from "@paon/database";
import {
  asId,
  updateProductInputSchema,
  updateProductVariantInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CatalogueFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
  saved?: boolean;
}

const errorsFrom = (
  issues: readonly { path: PropertyKey[]; message: string }[],
) => {
  const result: Record<string, string> = {};
  for (const issue of issues) result[issue.path.join(".")] ??= issue.message;
  return result;
};

export async function updateProduct(
  _previous: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const parsed = updateProductInputSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    status: formData.get("status"),
    isMadeToOrder: formData.get("isMadeToOrder") === "on",
    isAlterable: formData.get("isAlterable") === "on",
    primaryImageUrl: formData.get("primaryImageUrl") || undefined,
    collectionIds: formData.getAll("collectionIds"),
  });
  const productId = String(formData.get("productId"));
  if (!parsed.success) return { fieldErrors: errorsFrom(parsed.error.issues) };
  try {
    await new ProductRepository(await getSupabaseServerClient()).update(
      asId<"ProductId">(productId),
      {
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        status: parsed.data.status,
        isMadeToOrder: parsed.data.isMadeToOrder,
        isAlterable: parsed.data.isAlterable,
        ...(parsed.data.primaryImageUrl
          ? { primaryImageUrl: parsed.data.primaryImageUrl }
          : {}),
        collectionIds: parsed.data.collectionIds.map((id) =>
          asId<"CollectionId">(id),
        ),
      },
    );
  } catch (error) {
    if (error instanceof ProductSlugAlreadyExistsError) {
      return { fieldErrors: { slug: error.message } };
    }
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Update failed",
    };
  }
  revalidatePath(`/products/${productId}`);
  return { fieldErrors: {}, saved: true };
}

export async function updateVariant(
  _previous: CatalogueFormState,
  formData: FormData,
): Promise<CatalogueFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const parsed = updateProductVariantInputSchema.safeParse({
    id: formData.get("id"),
    sku: formData.get("sku"),
    size: formData.get("size") || undefined,
    color: formData.get("color") || undefined,
    priceAmountMinorUnits: formData.get("priceAmountMinorUnits"),
    priceCurrency: formData.get("priceCurrency"),
    compareAtPriceAmountMinorUnits:
      formData.get("compareAtPriceAmountMinorUnits") || undefined,
    inventoryQuantity: formData.get("inventoryQuantity"),
    leadTimeDays: formData.get("leadTimeDays") || undefined,
  });
  const productId = String(formData.get("productId"));
  if (!parsed.success) return { fieldErrors: errorsFrom(parsed.error.issues) };
  try {
    await new ProductVariantRepository(await getSupabaseServerClient()).update(
      asId<"ProductVariantId">(parsed.data.id),
      {
        sku: parsed.data.sku,
        ...(parsed.data.size ? { size: parsed.data.size } : {}),
        ...(parsed.data.color ? { color: parsed.data.color } : {}),
        price: {
          amountMinorUnits: parsed.data.priceAmountMinorUnits,
          currency: parsed.data.priceCurrency,
        },
        ...(parsed.data.compareAtPriceAmountMinorUnits !== undefined
          ? {
              compareAtPrice: {
                amountMinorUnits: parsed.data.compareAtPriceAmountMinorUnits,
                currency: parsed.data.priceCurrency,
              },
            }
          : {}),
        inventoryQuantity: parsed.data.inventoryQuantity,
        ...(parsed.data.leadTimeDays !== undefined
          ? { leadTimeDays: parsed.data.leadTimeDays }
          : {}),
      },
    );
  } catch (error) {
    if (error instanceof VariantSkuAlreadyExistsError)
      return { fieldErrors: { sku: error.message } };
    return {
      fieldErrors: {},
      formError: error instanceof Error ? error.message : "Update failed",
    };
  }
  revalidatePath(`/products/${productId}`);
  return { fieldErrors: {}, saved: true };
}
