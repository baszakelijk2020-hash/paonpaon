"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  ProductRepository,
  ProductSlugAlreadyExistsError,
  ProductVariantRepository,
  VariantSkuAlreadyExistsError,
} from "@paon/database";
import {
  createProductInputSchema,
  createProductVariantInputSchema,
} from "@paon/domain";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateProductFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export async function createProduct(
  _prevState: CreateProductFormState,
  formData: FormData,
): Promise<CreateProductFormState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "manager");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsedProduct = createProductInputSchema.safeParse({
    name: raw["name"],
    slug: raw["slug"],
    description: raw["description"],
    status: raw["status"] || undefined,
    isMadeToOrder: raw["isMadeToOrder"] === "on",
    isAlterable: raw["isAlterable"] === "on",
  });

  const parsedVariant = createProductVariantInputSchema.safeParse({
    sku: raw["sku"],
    size: raw["size"] || undefined,
    color: raw["color"] || undefined,
    priceAmountMinorUnits: raw["priceAmountMinorUnits"],
    priceCurrency: raw["priceCurrency"],
    inventoryQuantity: raw["inventoryQuantity"] || undefined,
    leadTimeDays: raw["leadTimeDays"] || undefined,
  });

  const fieldErrors: Record<string, string> = {};
  for (const issue of [
    ...(parsedProduct.success ? [] : parsedProduct.error.issues),
    ...(parsedVariant.success ? [] : parsedVariant.error.issues),
  ]) {
    const key = issue.path.join(".");
    fieldErrors[key] ??= issue.message;
  }

  if (!parsedProduct.success || !parsedVariant.success) {
    return { values: raw, fieldErrors };
  }

  const supabase = await getSupabaseServerClient();
  const productRepo = new ProductRepository(supabase);

  let productId: string;
  try {
    const product = await productRepo.create({
      retailerId: session.retailerId,
      name: parsedProduct.data.name,
      slug: parsedProduct.data.slug,
      description: parsedProduct.data.description,
      status: parsedProduct.data.status,
      isMadeToOrder: parsedProduct.data.isMadeToOrder,
      isAlterable: parsedProduct.data.isAlterable,
    });
    productId = product.id;
  } catch (error) {
    if (error instanceof ProductSlugAlreadyExistsError) {
      return { values: raw, fieldErrors: { slug: error.message } };
    }
    throw error;
  }

  const variantRepo = new ProductVariantRepository(supabase);
  try {
    await variantRepo.create({
      productId: productId as never,
      sku: parsedVariant.data.sku,
      ...(parsedVariant.data.size ? { size: parsedVariant.data.size } : {}),
      ...(parsedVariant.data.color ? { color: parsedVariant.data.color } : {}),
      price: {
        amountMinorUnits: parsedVariant.data.priceAmountMinorUnits,
        currency: parsedVariant.data.priceCurrency,
      },
      inventoryQuantity: parsedVariant.data.inventoryQuantity,
      ...(parsedVariant.data.leadTimeDays !== undefined
        ? { leadTimeDays: parsedVariant.data.leadTimeDays }
        : {}),
    });
  } catch (error) {
    if (error instanceof VariantSkuAlreadyExistsError) {
      return {
        values: raw,
        fieldErrors: {},
        formError: `Product created, but the variant failed: ${error.message} Find the product in the list and add a variant with a different SKU.`,
      };
    }
    throw error;
  }

  redirect(`/products/${productId}`);
}
