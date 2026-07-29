import { z } from "zod";

import type {
  CatalogueImportRowStatus,
  CatalogueImportSourceType,
  CatalogueImportStatus,
  CatalogueImportValidationCode,
  CatalogueImportValidationSeverity,
  MetadataReviewTaskStatus,
} from "./import";
import {
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  CATALOGUE_IMPORT_COLUMNS,
  type CatalogueImportColumn,
} from "./import-contract";

const uuidSchema = z.string().uuid();

export const catalogueImportSourceTypeSchema = z.enum([
  "csv",
  "xlsx",
  "json",
  "pdf",
] as const satisfies readonly CatalogueImportSourceType[]);

export const catalogueImportStatusSchema = z.enum([
  "uploaded",
  "previewing",
  "ready",
  "publishing",
  "completed",
  "failed",
] as const satisfies readonly CatalogueImportStatus[]);

export const catalogueImportRowStatusSchema = z.enum([
  "pending",
  "valid",
  "rejected",
  "published",
] as const satisfies readonly CatalogueImportRowStatus[]);

export const metadataReviewTaskStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "dismissed",
] as const satisfies readonly MetadataReviewTaskStatus[]);

export const catalogueImportValidationCodeSchema = z.enum([
  "missing_required",
  "invalid_value",
  "formula_injection",
  "duplicate_in_file",
  "duplicate_existing_sku",
  "duplicate_existing_slug",
  "duplicate_existing_image",
  "asset_unmatched",
  "category_unmapped",
  "size_limit",
  "malformed_row",
] as const satisfies readonly CatalogueImportValidationCode[]);

export const catalogueImportValidationSeveritySchema = z.enum([
  "error",
  "warning",
  "info",
] as const satisfies readonly CatalogueImportValidationSeverity[]);

export const catalogueImportValidationIssueSchema = z.object({
  code: catalogueImportValidationCodeSchema,
  severity: catalogueImportValidationSeveritySchema,
  field: z.string().trim().min(1).max(80).optional(),
  message: z.string().trim().min(1).max(500),
  explanation: z.string().trim().min(1).max(1000),
});

export const catalogueImportAssetMatchSchema = z.object({
  role: z.enum(["primary", "swatch"]),
  sourceUrl: z.string().trim().url().max(2000).optional(),
  matched: z.boolean(),
  matchReason: z.string().trim().min(1).max(500),
});

export const catalogueImportCategoryMappingSchema = z.object({
  rawValue: z.string().trim().min(1).max(200),
  mappedConceptSlug: z.string().trim().min(1).max(120).optional(),
  mappedConceptId: uuidSchema.optional(),
  status: z.enum(["mapped", "proposed", "unmapped"]),
  explanation: z.string().trim().min(1).max(1000),
});

export const catalogueImportProposedProductSchema = z.object({
  externalSku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  garmentType: z.string().trim().max(120).optional(),
  priceAmountMinorUnits: z.number().int().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  primaryImageUrl: z.string().trim().url().max(2000).optional(),
  swatchImageUrl: z.string().trim().url().max(2000).optional(),
  mill: z.string().trim().max(200).optional(),
  collection: z.string().trim().max(200).optional(),
  composition: z.string().trim().max(500).optional(),
  weightGsm: z.number().positive().max(2000).optional(),
  season: z.string().trim().max(120).optional(),
  colour: z.string().trim().max(120).optional(),
  supplierReference: z.string().trim().max(200).optional(),
  weave: z.string().trim().max(120).optional(),
  pattern: z.string().trim().max(120).optional(),
  construction: z.string().trim().max(120).optional(),
  fit: z.string().trim().max(120).optional(),
  formality: z.string().trim().max(120).optional(),
  occasion: z.string().trim().max(120).optional(),
  climate: z.string().trim().max(120).optional(),
  performance: z.string().trim().max(120).optional(),
  care: z.string().trim().max(120).optional(),
  proposedSlug: z.string().trim().max(100).optional(),
  assetMatches: z.array(catalogueImportAssetMatchSchema).max(8),
  categoryMappings: z.array(catalogueImportCategoryMappingSchema).max(30),
});

export const createCatalogueImportInputSchema = z.object({
  retailerId: uuidSchema,
  uploadedByStaffId: uuidSchema,
  sourceFilename: z.string().trim().min(1).max(255),
  sourceType: catalogueImportSourceTypeSchema.exclude(["pdf"]),
  contractVersion: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .default(CATALOGUE_IMPORT_CONTRACT_VERSION),
  rowCount: z.number().int().min(0).max(10_000),
  status: catalogueImportStatusSchema.default("previewing"),
});

export type CreateCatalogueImportInput = z.infer<
  typeof createCatalogueImportInputSchema
>;

export const createCatalogueImportRowInputSchema = z.object({
  importId: uuidSchema,
  retailerId: uuidSchema,
  rowNumber: z.number().int().positive().max(10_000),
  externalSku: z.string().trim().min(1).max(64).optional(),
  rawPayload: z.record(z.unknown()),
  proposedProduct: catalogueImportProposedProductSchema.optional(),
  validationErrors: z.array(catalogueImportValidationIssueSchema).max(100),
  status: catalogueImportRowStatusSchema.default("pending"),
});

export type CreateCatalogueImportRowInput = z.infer<
  typeof createCatalogueImportRowInputSchema
>;

export const createMetadataReviewTaskInputSchema = z.object({
  retailerId: uuidSchema,
  importRowId: uuidSchema.optional(),
  assignmentId: uuidSchema.optional(),
  proposedConceptId: uuidSchema.optional(),
  proposedValue: z.string().trim().min(1).max(500),
  source: z.enum(["supplier", "ai", "retailer", "paon"]),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .refine(
      (value) => Number.isInteger(value * 10_000),
      "Confidence supports at most 4 decimal places",
    )
    .optional(),
  status: metadataReviewTaskStatusSchema.default("pending"),
});

export type CreateMetadataReviewTaskInput = z.infer<
  typeof createMetadataReviewTaskInputSchema
>;

export const reviewCatalogueImportTaskInputSchema = z.object({
  taskId: uuidSchema,
  status: metadataReviewTaskStatusSchema.exclude(["pending"]),
});

export type ReviewCatalogueImportTaskInput = z.infer<
  typeof reviewCatalogueImportTaskInputSchema
>;

export const publishCatalogueImportRowInputSchema = z.object({
  importRowId: uuidSchema,
});

export type PublishCatalogueImportRowInput = z.infer<
  typeof publishCatalogueImportRowInputSchema
>;

export const catalogueImportPublishResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    productId: uuidSchema,
    variantId: uuidSchema.optional(),
    outcome: z.enum(["created", "updated", "already_published"]),
  }),
  z.object({
    ok: z.literal(false),
    code: z.enum([
      "invalid_row",
      "not_reviewed",
      "publish_failed",
      "unauthorized",
    ]),
    error: z.string().trim().min(1).max(1000),
  }),
]);

export type CatalogueImportPublishResultParsed = z.infer<
  typeof catalogueImportPublishResultSchema
>;

export const catalogueImportRawRowSchema = z.record(z.string());

export const catalogueImportColumnSchema = z.enum(
  CATALOGUE_IMPORT_COLUMNS as unknown as [
    CatalogueImportColumn,
    ...CatalogueImportColumn[],
  ],
);
