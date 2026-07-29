import { z } from "zod";

import type {
  MetadataConceptKind,
  MetadataEdgeKind,
  MetadataReviewStatus,
  MetadataSource,
} from "./metadata";

export const METADATA_CONCEPT_KINDS = [
  "mill",
  "fabric_collection",
  "fibre",
  "weave",
  "weight_band",
  "pattern",
  "colour",
  "season",
  "garment_type",
  "construction",
  "fit",
  "formality",
  "climate",
  "performance",
  "care",
  "style",
  "occasion",
  "compatibility",
  "collar",
  "silhouette",
] as const satisfies readonly MetadataConceptKind[];

export const METADATA_SOURCES = [
  "supplier",
  "ai",
  "retailer",
  "paon",
] as const satisfies readonly MetadataSource[];

export const METADATA_REVIEW_STATUSES = [
  "pending",
  "accepted",
  "rejected",
] as const satisfies readonly MetadataReviewStatus[];

export const METADATA_EDGE_KINDS = [
  "parent",
  "related",
  "equivalent",
  "suggests",
  "compatible_with",
  "incompatible_with",
] as const satisfies readonly MetadataEdgeKind[];

export const metadataConceptKindSchema = z.enum(METADATA_CONCEPT_KINDS);
export const metadataSourceSchema = z.enum(METADATA_SOURCES);
export const metadataReviewStatusSchema = z.enum(METADATA_REVIEW_STATUSES);
export const metadataEdgeKindSchema = z.enum(METADATA_EDGE_KINDS);

const metadataSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const uuidSchema = z.string().uuid();

function hasAtMostDecimalPlaces(value: number, decimalPlaces: number): boolean {
  const scale = 10 ** decimalPlaces;
  const scaledValue = value * scale;
  return Math.abs(scaledValue - Math.round(scaledValue)) < 1e-8;
}

const confidenceSchema = z
  .number()
  .finite()
  .min(0)
  .max(1)
  .refine((value) => hasAtMostDecimalPlaces(value, 4), {
    message: "Confidence supports at most four decimal places",
  });

export const metadataEvidenceSchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  sourceReference: z.string().trim().min(1).max(500).optional(),
});

export const createMetadataConceptInputSchema = z.object({
  retailerId: uuidSchema.nullable().default(null),
  kind: metadataConceptKindSchema,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(120)
    .regex(metadataSlugPattern, "Lowercase letters, numbers and hyphens only"),
  canonicalName: z.string().trim().min(1).max(200),
  attributes: z.record(z.string(), z.unknown()).default({}),
  imageUrl: z.string().trim().url().max(2000).optional(),
  active: z.boolean().default(true),
});

export type CreateMetadataConceptInput = z.infer<
  typeof createMetadataConceptInputSchema
>;

export const createMetadataConceptEdgeInputSchema = z
  .object({
    retailerId: uuidSchema.nullable().default(null),
    sourceConceptId: uuidSchema,
    targetConceptId: uuidSchema,
    kind: metadataEdgeKindSchema,
    weight: z
      .number()
      .finite()
      .min(0)
      .max(1)
      .refine((value) => hasAtMostDecimalPlaces(value, 4), {
        message: "Edge weight supports at most four decimal places",
      })
      .default(1),
  })
  .refine((value) => value.sourceConceptId !== value.targetConceptId, {
    message: "A concept edge cannot point to itself",
    path: ["targetConceptId"],
  });

export type CreateMetadataConceptEdgeInput = z.infer<
  typeof createMetadataConceptEdgeInputSchema
>;

export const metadataTargetSchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("product"),
    targetId: uuidSchema,
  }),
  z.object({
    targetType: z.literal("product_variant"),
    targetId: uuidSchema,
  }),
  z.object({
    targetType: z.literal("wardrobe_item"),
    targetId: uuidSchema,
  }),
]);

export const createEntityMetadataAssignmentInputSchema = z
  .object({
    retailerId: uuidSchema,
    target: metadataTargetSchema,
    conceptId: uuidSchema,
    source: metadataSourceSchema,
    confidence: confidenceSchema.optional(),
    reviewStatus: metadataReviewStatusSchema.default("pending"),
    supplierValue: z.string().trim().min(1).max(1000).optional(),
    evidence: metadataEvidenceSchema.optional(),
    reviewedByStaffId: uuidSchema.optional(),
    reviewedAt: z.string().datetime().optional(),
  })
  .superRefine((value, context) => {
    if (value.source === "ai" && value.confidence === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confidence"],
        message: "AI assignments require confidence",
      });
    }

    if (value.source === "ai" && value.evidence === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidence"],
        message: "AI assignments require evidence",
      });
    }

    if (value.source === "supplier" && value.supplierValue === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supplierValue"],
        message: "Supplier assignments must preserve the raw supplier value",
      });
    }

    const hasReviewer = value.reviewedByStaffId !== undefined;
    const hasReviewTime = value.reviewedAt !== undefined;

    if (value.reviewStatus === "pending" && (hasReviewer || hasReviewTime)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewStatus"],
        message: "Pending assignments cannot contain completed review data",
      });
    }

    if (value.reviewStatus !== "pending" && (!hasReviewer || !hasReviewTime)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reviewedByStaffId"],
        message: "Accepted or rejected assignments require reviewer and time",
      });
    }
  });

export type CreateEntityMetadataAssignmentInput = z.infer<
  typeof createEntityMetadataAssignmentInputSchema
>;

export const createRetailerConceptOverrideInputSchema = z.object({
  retailerId: uuidSchema,
  conceptId: uuidSchema,
  displayName: z.string().trim().min(1).max(200).optional(),
  summaryOverride: z.string().trim().min(1).max(2000).optional(),
  imageUrlOverride: z.string().trim().url().max(2000).optional(),
  isHidden: z.boolean().default(false),
  priorityOverride: z.number().int().min(-1000).max(1000).optional(),
});

export type CreateRetailerConceptOverrideInput = z.infer<
  typeof createRetailerConceptOverrideInputSchema
>;

const productFabricCompositionSchema = z.object({
  fibreConceptId: uuidSchema,
  percentage: z
    .number()
    .finite()
    .positive()
    .max(100)
    .refine((value) => hasAtMostDecimalPlaces(value, 4), {
      message: "Composition percentage supports at most four decimal places",
    }),
});

export const productFabricProfileSchema = z
  .object({
    fabricWeightGramsPerSquareMetre: z
      .number()
      .finite()
      .positive()
      .max(2000)
      .refine((value) => hasAtMostDecimalPlaces(value, 2), {
        message: "Fabric weight supports at most two decimal places",
      })
      .optional(),
    composition: z.array(productFabricCompositionSchema).max(20).default([]),
    supplierReference: z.string().trim().min(1).max(200).optional(),
  })
  .superRefine((value, context) => {
    const fibreIds = new Set<string>();

    for (const [index, component] of value.composition.entries()) {
      if (fibreIds.has(component.fibreConceptId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["composition", index, "fibreConceptId"],
          message: "A fibre concept may appear only once",
        });
      }
      fibreIds.add(component.fibreConceptId);
    }

    if (value.composition.length === 0) {
      return;
    }

    const scaledTotal = value.composition.reduce(
      (total, component) => total + Math.round(component.percentage * 10_000),
      0,
    );

    if (scaledTotal !== 100 * 10_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["composition"],
        message: "Composition percentages must total exactly 100",
      });
    }
  });

export type ProductFabricProfileInput = z.infer<
  typeof productFabricProfileSchema
>;
