import {
  createEntityMetadataAssignmentInputSchema,
  createMetadataConceptInputSchema,
  createRetailerConceptOverrideInputSchema,
  productFabricProfileSchema,
  reviewMetadataAssignmentInputSchema,
  type CreateEntityMetadataAssignmentInput,
  type CreateMetadataConceptInput,
  type CreateRetailerConceptOverrideInput,
  type ProductFabricProfileInput,
  type ReviewMetadataAssignmentInput,
} from "./metadata.schema";

export type MetadataFormParseResult<T> =
  | { readonly success: true; readonly data: T }
  | {
      readonly success: false;
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

function optionalTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function optionalNumber(value: string | undefined): number | undefined {
  const trimmed = optionalTrimmed(value);
  if (trimmed === undefined) {
    return undefined;
  }
  return Number(trimmed);
}

/**
 * Builds a pending tenant assignment proposal from portal form fields.
 * Terminal review fields are ignored so unknown values cannot become accepted
 * canonical or accepted tenant data without an explicit review action.
 */
export function parseProposeAssignmentForm(
  retailerId: string,
  values: Readonly<Record<string, string>>,
): MetadataFormParseResult<CreateEntityMetadataAssignmentInput> {
  const evidenceSummary = optionalTrimmed(values["evidenceSummary"]);
  const evidenceSourceReference = optionalTrimmed(
    values["evidenceSourceReference"],
  );
  const parsed = createEntityMetadataAssignmentInputSchema.safeParse({
    retailerId,
    target: {
      targetType: values["targetType"],
      targetId: values["targetId"],
    },
    conceptId: values["conceptId"],
    source: values["source"],
    confidence: optionalNumber(values["confidence"]),
    supplierValue: optionalTrimmed(values["supplierValue"]),
    evidence:
      evidenceSummary === undefined
        ? undefined
        : {
            summary: evidenceSummary,
            ...(evidenceSourceReference === undefined
              ? {}
              : { sourceReference: evidenceSourceReference }),
          },
    reviewStatus: "pending",
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: fieldErrors(parsed.error.issues) };
  }

  return { success: true, data: parsed.data };
}

export function parseReviewAssignmentForm(
  values: Readonly<Record<string, string>>,
): MetadataFormParseResult<ReviewMetadataAssignmentInput> {
  const parsed = reviewMetadataAssignmentInputSchema.safeParse({
    assignmentId: values["assignmentId"],
    decision: values["decision"],
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: fieldErrors(parsed.error.issues) };
  }

  return { success: true, data: parsed.data };
}

/**
 * Retailer-owned concepts stay local. Passing a null retailer id is rejected so
 * portal staff cannot silently expand the PAON canonical taxonomy.
 */
export function parseCreateRetailerConceptForm(
  retailerId: string,
  values: Readonly<Record<string, string>>,
): MetadataFormParseResult<CreateMetadataConceptInput> {
  const parsed = createMetadataConceptInputSchema.safeParse({
    retailerId,
    kind: values["kind"],
    slug: values["slug"],
    canonicalName: values["canonicalName"],
    attributes: {},
    imageUrl: optionalTrimmed(values["imageUrl"]),
    active: true,
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: fieldErrors(parsed.error.issues) };
  }

  if (parsed.data.retailerId === null) {
    return {
      success: false,
      fieldErrors: {
        retailerId: "Retailer concepts must remain tenant-owned",
      },
    };
  }

  return { success: true, data: parsed.data };
}

export function parseRetailerOverrideForm(
  retailerId: string,
  values: Readonly<Record<string, string>>,
): MetadataFormParseResult<CreateRetailerConceptOverrideInput> {
  const parsed = createRetailerConceptOverrideInputSchema.safeParse({
    retailerId,
    conceptId: values["conceptId"],
    displayName: optionalTrimmed(values["displayName"]),
    summaryOverride: optionalTrimmed(values["summaryOverride"]),
    imageUrlOverride: optionalTrimmed(values["imageUrlOverride"]),
    isHidden: values["isHidden"] === "on",
    priorityOverride: optionalNumber(values["priorityOverride"]),
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: fieldErrors(parsed.error.issues) };
  }

  return { success: true, data: parsed.data };
}

export interface ProductFabricProfileFormValues {
  readonly fabricWeightGramsPerSquareMetre?: string;
  readonly supplierReference?: string;
  readonly fibreConceptIds?: readonly string[];
  readonly percentages?: readonly string[];
}

/**
 * Parses exact fabric facts from product-management forms. Composition is
 * concept-linked only — there is no parallel free-text fibre/label field.
 * Incomplete totals fail closed before any repository write.
 */
export function parseProductFabricProfileForm(
  values: ProductFabricProfileFormValues,
): MetadataFormParseResult<ProductFabricProfileInput> {
  const fibreConceptIds = values.fibreConceptIds ?? [];
  const percentages = values.percentages ?? [];

  if (fibreConceptIds.length !== percentages.length) {
    return {
      success: false,
      fieldErrors: {
        composition: "Each fibre concept needs a matching percentage",
      },
    };
  }

  const composition = fibreConceptIds.flatMap((fibreConceptId, index) => {
    const fibre = optionalTrimmed(fibreConceptId);
    const percentageRaw = optionalTrimmed(percentages[index]);
    if (fibre === undefined && percentageRaw === undefined) {
      return [];
    }
    return [
      {
        fibreConceptId: fibre,
        percentage: percentageRaw === undefined ? NaN : Number(percentageRaw),
      },
    ];
  });

  const parsed = productFabricProfileSchema.safeParse({
    fabricWeightGramsPerSquareMetre: optionalNumber(
      values.fabricWeightGramsPerSquareMetre,
    ),
    supplierReference: optionalTrimmed(values.supplierReference),
    composition,
  });

  if (!parsed.success) {
    return { success: false, fieldErrors: fieldErrors(parsed.error.issues) };
  }

  return { success: true, data: parsed.data };
}
