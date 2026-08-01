"use server";

import { requireRetailerRole } from "@paon/auth";
import { MetadataRepository } from "@paon/database";
import {
  asId,
  parseCreateRetailerConceptForm,
  parseProposeAssignmentForm,
  parseRetailerOverrideForm,
  parseReviewAssignmentForm,
  type MetadataTarget,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface MetadataFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
  saved?: boolean;
}

function valuesFromForm(formData: FormData): Record<string, string> {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

async function requireManagerSession() {
  const session = await requireModuleSession("wardrobe_styling");
  requireRetailerRole(session.retailerRole, "manager");
  return session;
}

function toMetadataTarget(target: {
  targetType: "product" | "product_variant" | "wardrobe_item";
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
    case "wardrobe_item":
      return {
        targetType: "wardrobe_item",
        targetId: asId<"WardrobeItemId">(target.targetId),
      };
  }
}

export async function proposeMetadataAssignment(
  _previous: MetadataFormState,
  formData: FormData,
): Promise<MetadataFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const parsed = parseProposeAssignmentForm(session.retailerId, values);

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
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
      target: toMetadataTarget(parsed.data.target),
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
          : "The metadata assignment could not be proposed.",
    };
  }

  revalidatePath("/metadata");
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function reviewMetadataAssignment(
  _previous: MetadataFormState,
  formData: FormData,
): Promise<MetadataFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const parsed = parseReviewAssignmentForm(values);

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
    await new MetadataRepository(
      await getSupabaseServerClient(),
    ).reviewAssignment(
      session.retailerId,
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
          : "The metadata assignment could not be reviewed.",
    };
  }

  revalidatePath("/metadata");
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function createRetailerMetadataConcept(
  _previous: MetadataFormState,
  formData: FormData,
): Promise<MetadataFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const parsed = parseCreateRetailerConceptForm(session.retailerId, values);

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  if (parsed.data.retailerId === null) {
    return {
      values,
      fieldErrors: {
        retailerId: "Retailer concepts must remain tenant-owned",
      },
    };
  }

  try {
    await new MetadataRepository(await getSupabaseServerClient()).createConcept(
      {
        retailerId: asId<"RetailerId">(parsed.data.retailerId),
        kind: parsed.data.kind,
        slug: parsed.data.slug,
        canonicalName: parsed.data.canonicalName,
        attributes: parsed.data.attributes,
        ...(parsed.data.imageUrl === undefined
          ? {}
          : { imageUrl: parsed.data.imageUrl }),
        active: true,
      },
    );
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The local concept could not be created.",
    };
  }

  revalidatePath("/metadata");
  return { values: {}, fieldErrors: {}, saved: true };
}

export async function upsertRetailerConceptOverride(
  _previous: MetadataFormState,
  formData: FormData,
): Promise<MetadataFormState> {
  const session = await requireManagerSession();
  const values = valuesFromForm(formData);
  const parsed = parseRetailerOverrideForm(session.retailerId, values);

  if (!parsed.success) {
    return { values, fieldErrors: { ...parsed.fieldErrors } };
  }

  try {
    await new MetadataRepository(
      await getSupabaseServerClient(),
    ).upsertOverride({
      retailerId: asId<"RetailerId">(parsed.data.retailerId),
      conceptId: asId<"MetadataConceptId">(parsed.data.conceptId),
      ...(parsed.data.displayName === undefined
        ? {}
        : { displayName: parsed.data.displayName }),
      ...(parsed.data.summaryOverride === undefined
        ? {}
        : { summaryOverride: parsed.data.summaryOverride }),
      ...(parsed.data.imageUrlOverride === undefined
        ? {}
        : { imageUrlOverride: parsed.data.imageUrlOverride }),
      isHidden: parsed.data.isHidden,
      ...(parsed.data.priorityOverride === undefined
        ? {}
        : { priorityOverride: parsed.data.priorityOverride }),
    });
  } catch (error) {
    return {
      values,
      fieldErrors: {},
      formError:
        error instanceof Error
          ? error.message
          : "The concept override could not be saved.",
    };
  }

  revalidatePath("/metadata");
  return { values: {}, fieldErrors: {}, saved: true };
}
