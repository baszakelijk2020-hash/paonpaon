"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  MetadataRepository,
  ProductFabricProfileRepository,
  ProductRepository,
  ProductVariantRepository,
} from "@paon/database";
import {
  asId,
  parseProductFabricProfileForm,
  parseProposeAssignmentForm,
  parseReviewAssignmentForm,
  type MetadataTarget,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ProductFactsFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  saved?: boolean;
}

function valuesFromForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

async function requireManagerSession() {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  return session;
}

function toMetadataTarget(target: {
  targetType: "product" | "product_variant";
  targetId: string;
}): MetadataTarget {
  switch (target.targetType) {
    case "product":
      return {
        targetType: "product",
        targetId: asId<"ProductId">(target.targetId),
      };
    case "product_variant":
      return {
        targetType: "product_variant",
        targetId: asId<"ProductVariantId">(target.targetId),
      };
  }
}

async function assertProductOwnedBySession(
  productId: string,
  retailerId: string,
) {
  const product = await new ProductRepository(
    await getSupabaseServerClient(),
  ).findById(asId<"ProductId">(productId));
  if (!product || product.retailerId !== retailerId) {
    throw new Error("Product not found.");
  }
  return product;
}

async function assertVariantOwnedByProduct(
  productId: string,
  variantId: string,
) {
  const variant = await new ProductVariantRepository(
    await getSupabaseServerClient(),
  ).findById(asId<"ProductVariantId">(variantId));
  if (!variant || variant.productId !== productId) {
    throw new Error("Variant does not belong to this product.");
  }
  return variant;
}

export async function saveProductFabricProfile(
  _previous: ProductFactsFormState,
  formData: FormData,
): Promise<ProductFactsFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const productId = values["productId"] ?? "";
  const fibreConceptIds = formData.getAll("fibreConceptId").map(String);
  const percentages = formData.getAll("percentage").map(String);
  const parsed = parseProductFabricProfileForm({
    ...(values["fabricWeightGramsPerSquareMetre"] === undefined
      ? {}
      : {
          fabricWeightGramsPerSquareMetre:
            values["fabricWeightGramsPerSquareMetre"],
        }),
    ...(values["supplierReference"] === undefined
      ? {}
      : { supplierReference: values["supplierReference"] }),
    fibreConceptIds,
    percentages,
  });

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
    await assertProductOwnedBySession(productId, session.retailerId);
    await new ProductFabricProfileRepository(
      await getSupabaseServerClient(),
    ).setForProduct(
      asId<"RetailerId">(session.retailerId),
      asId<"ProductId">(productId),
      parsed.data,
    );
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The fabric profile could not be saved.",
    };
  }

  revalidatePath(`/products/${productId}`);
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function saveVariantFabricProfile(
  _previous: ProductFactsFormState,
  formData: FormData,
): Promise<ProductFactsFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const productId = values["productId"] ?? "";
  const variantId = values["productVariantId"] ?? "";
  const fibreConceptIds = formData.getAll("fibreConceptId").map(String);
  const percentages = formData.getAll("percentage").map(String);
  const parsed = parseProductFabricProfileForm({
    ...(values["fabricWeightGramsPerSquareMetre"] === undefined
      ? {}
      : {
          fabricWeightGramsPerSquareMetre:
            values["fabricWeightGramsPerSquareMetre"],
        }),
    ...(values["supplierReference"] === undefined
      ? {}
      : { supplierReference: values["supplierReference"] }),
    fibreConceptIds,
    percentages,
  });

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
    await assertProductOwnedBySession(productId, session.retailerId);
    await assertVariantOwnedByProduct(productId, variantId);
    await new ProductFabricProfileRepository(
      await getSupabaseServerClient(),
    ).setForVariant(
      asId<"RetailerId">(session.retailerId),
      asId<"ProductId">(productId),
      asId<"ProductVariantId">(variantId),
      parsed.data,
    );
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The variant fabric profile could not be saved.",
    };
  }

  revalidatePath(`/products/${productId}`);
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function proposeProductCatalogueAssignment(
  _previous: ProductFactsFormState,
  formData: FormData,
): Promise<ProductFactsFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const productId = values["productId"] ?? "";
  const parsed = parseProposeAssignmentForm(session.retailerId, values);

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
    await assertProductOwnedBySession(productId, session.retailerId);
    if (parsed.data.target.targetType === "product") {
      if (parsed.data.target.targetId !== productId) {
        throw new Error("Assignment target must match this product.");
      }
    } else if (parsed.data.target.targetType === "product_variant") {
      await assertVariantOwnedByProduct(productId, parsed.data.target.targetId);
    } else {
      throw new Error("Only product and variant assignments are allowed here.");
    }

    const evidence =
      parsed.data.evidence === undefined
        ? undefined
        : {
            summary: parsed.data.evidence.summary,
            ...(parsed.data.evidence.sourceReference === undefined
              ? {}
              : { sourceReference: parsed.data.evidence.sourceReference }),
          };

    await new MetadataRepository(
      await getSupabaseServerClient(),
    ).createAssignment({
      retailerId: asId<"RetailerId">(parsed.data.retailerId),
      target: toMetadataTarget({
        targetType: parsed.data.target.targetType,
        targetId: parsed.data.target.targetId,
      }),
      conceptId: asId<"MetadataConceptId">(parsed.data.conceptId),
      source: parsed.data.source,
      ...(parsed.data.confidence === undefined
        ? {}
        : { confidence: parsed.data.confidence }),
      ...(parsed.data.supplierValue === undefined
        ? {}
        : { supplierValue: parsed.data.supplierValue }),
      ...(evidence === undefined ? {} : { evidence }),
    });
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The catalogue assignment could not be proposed.",
    };
  }

  revalidatePath(`/products/${productId}`);
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function reviewProductCatalogueAssignment(
  _previous: ProductFactsFormState,
  formData: FormData,
): Promise<ProductFactsFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const productId = values["productId"] ?? "";
  const parsed = parseReviewAssignmentForm(values);

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
    await assertProductOwnedBySession(productId, session.retailerId);
    const metadata = new MetadataRepository(await getSupabaseServerClient());
    const assignment = await metadata.findAssignmentById(
      asId<"RetailerId">(session.retailerId),
      asId<"EntityMetadataAssignmentId">(parsed.data.assignmentId),
    );
    if (!assignment || assignment.retailerId !== session.retailerId) {
      throw new Error("Assignment not found.");
    }
    if (assignment.target.targetType === "product") {
      if (assignment.target.targetId !== productId) {
        throw new Error("Assignment does not belong to this product.");
      }
    } else if (assignment.target.targetType === "product_variant") {
      await assertVariantOwnedByProduct(productId, assignment.target.targetId);
    } else {
      throw new Error("Only product and variant assignments are allowed here.");
    }

    await metadata.reviewAssignment(
      asId<"RetailerId">(session.retailerId),
      asId<"EntityMetadataAssignmentId">(parsed.data.assignmentId),
      parsed.data.decision,
    );
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The catalogue assignment could not be reviewed.",
    };
  }

  revalidatePath(`/products/${productId}`);
  return { values: {}, fieldErrors: {}, saved: true };
}
