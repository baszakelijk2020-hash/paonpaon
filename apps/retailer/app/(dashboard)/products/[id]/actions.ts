"use server";

import { randomUUID } from "node:crypto";

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

export interface ProductImageActionState {
  formError?: string;
  saved?: boolean;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export async function uploadProductImage(
  productId: string,
  _previous: ProductImageActionState,
  formData: FormData,
): Promise<ProductImageActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { formError: "Choose an image." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { formError: "Images must be 5 MB or smaller." };
  }
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return { formError: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = await getSupabaseServerClient();
  const productRepo = new ProductRepository(supabase);
  const product = await productRepo.findById(asId<"ProductId">(productId));
  if (!product) {
    return { formError: "Product not found." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const storagePath = `${session.retailerId}/${productId}/${randomUUID()}-${safeName}`;

  try {
    const publicUrl = await productRepo.uploadImage({
      storagePath,
      mimeType: file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
      content: await file.arrayBuffer(),
    });
    await productRepo.update(product.id, {
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      isMadeToOrder: product.isMadeToOrder,
      isAlterable: product.isAlterable,
      primaryImageUrl: publicUrl,
      collectionIds: product.collectionIds,
    });
    if (product.primaryImageUrl) {
      await productRepo.removeImageByPublicUrl(product.primaryImageUrl);
    }
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Upload failed",
    };
  }

  revalidatePath(`/products/${productId}`);
  return { saved: true };
}

export async function removeProductImage(
  productId: string,
  _previous: ProductImageActionState,
  _formData: FormData,
): Promise<ProductImageActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");

  const supabase = await getSupabaseServerClient();
  const productRepo = new ProductRepository(supabase);
  const product = await productRepo.findById(asId<"ProductId">(productId));
  if (!product) {
    return { formError: "Product not found." };
  }

  try {
    await productRepo.update(product.id, {
      name: product.name,
      slug: product.slug,
      description: product.description,
      status: product.status,
      isMadeToOrder: product.isMadeToOrder,
      isAlterable: product.isAlterable,
      collectionIds: product.collectionIds,
    });
    if (product.primaryImageUrl) {
      await productRepo.removeImageByPublicUrl(product.primaryImageUrl);
    }
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Remove failed",
    };
  }

  revalidatePath(`/products/${productId}`);
  return { saved: true };
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
    collectionIds: formData.getAll("collectionIds"),
  });
  const productId = String(formData.get("productId"));
  if (!parsed.success) return { fieldErrors: errorsFrom(parsed.error.issues) };
  try {
    const productRepo = new ProductRepository(await getSupabaseServerClient());
    // This form no longer owns primaryImageUrl (ProductImageUploader does)
    // — preserve whatever it's currently set to rather than clearing it,
    // since the update RPC has no "leave unchanged" sentinel of its own.
    const current = await productRepo.findById(asId<"ProductId">(productId));
    await productRepo.update(asId<"ProductId">(productId), {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description,
      status: parsed.data.status,
      isMadeToOrder: parsed.data.isMadeToOrder,
      isAlterable: parsed.data.isAlterable,
      ...(current?.primaryImageUrl
        ? { primaryImageUrl: current.primaryImageUrl }
        : {}),
      collectionIds: parsed.data.collectionIds.map((id) =>
        asId<"CollectionId">(id),
      ),
    });
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
