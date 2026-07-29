import { z } from "zod";

import { currencyCodeSchema } from "../retailer/retailer.schema";

import {
  CATALOGUE_IMPORT_CONTRACT_VERSION,
  CATALOGUE_IMPORT_ROW_STATUSES,
  CATALOGUE_IMPORT_SOURCE_TYPES,
  CATALOGUE_IMPORT_STATUSES,
  METADATA_REVIEW_TASK_STATUSES,
} from "./import";
import {
  CATALOGUE_IMPORT_CONTRACT_FIELDS,
  normalizeImportFieldKey,
} from "./import-contract";

const uuidSchema = z.string().uuid();

export const catalogueImportSourceTypeSchema = z.enum(
  CATALOGUE_IMPORT_SOURCE_TYPES,
);
export const catalogueImportStatusSchema = z.enum(CATALOGUE_IMPORT_STATUSES);
export const catalogueImportRowStatusSchema = z.enum(
  CATALOGUE_IMPORT_ROW_STATUSES,
);
export const metadataReviewTaskStatusSchema = z.enum(
  METADATA_REVIEW_TASK_STATUSES,
);

export const importValidationIssueSchema = z.object({
  field: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(80),
  message: z.string().trim().min(1).max(500),
});

export const importConceptMappingSchema = z.object({
  kind: z.string().trim().min(1),
  supplierValue: z.string().trim().min(1).max(200),
  conceptId: uuidSchema.optional(),
  conceptSlug: z.string().trim().min(1).max(120).optional(),
  conceptName: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["matched", "proposed", "missing"]),
});

export const importAssetMatchSchema = z.object({
  primaryImageUrl: z.string().trim().url().max(2000).optional(),
  swatchImageUrl: z.string().trim().url().max(2000).optional(),
  matchKey: z.enum(["external_sku", "supplier_reference"]),
  matchValue: z.string().trim().min(1).max(200),
  note: z.string().trim().min(1).max(500),
});

export const importProposedProductSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(100),
  description: z.string().trim().max(4000),
  externalSku: z.string().trim().min(1).max(64),
  supplierReference: z.string().trim().min(1).max(120).optional(),
  variantSku: z.string().trim().min(1).max(64),
  priceAmountMinorUnits: z.number().int().min(0),
  priceCurrency: currencyCodeSchema,
  weightGramsPerSquareMetre: z
    .number()
    .finite()
    .positive()
    .max(2000)
    .optional(),
  compositionRaw: z.string().trim().min(1).max(500).optional(),
  assignments: z.array(importConceptMappingSchema),
  assets: importAssetMatchSchema,
  duplicateOfRowNumbers: z.array(z.number().int().positive()).optional(),
  existingCatalogueSku: z.string().trim().min(1).max(64).optional(),
  existingCatalogueSlug: z.string().trim().min(1).max(100).optional(),
});

export const importRawRowSchema = z
  .record(z.string(), z.string())
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (key.length > 120) {
        ctx.addIssue({
          code: "custom",
          message: `Field key "${key}" exceeds 120 characters`,
        });
      }
    }
  });

export const importJsonEnvelopeSchema = z.object({
  contractVersion: z.literal(CATALOGUE_IMPORT_CONTRACT_VERSION),
  sourceType: catalogueImportSourceTypeSchema,
  rows: z.array(importRawRowSchema).max(5000),
});

const allowedFieldKeys = new Set(
  CATALOGUE_IMPORT_CONTRACT_FIELDS.map((field) => field.key),
);

export function normalizeImportRow(
  row: Readonly<Record<string, string>>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(row)) {
    const key = normalizeImportFieldKey(rawKey);
    if (!allowedFieldKeys.has(key)) {
      continue;
    }
    normalized[key] = sanitizeImportCell(String(rawValue));
  }
  return normalized;
}

/** Neutralize spreadsheet formula injection before values are stored or displayed. */
export function sanitizeImportCell(value: string): string {
  const trimmed = value.trim();
  if (/^[=+\-@]/.test(trimmed)) {
    return trimmed.slice(1).trimStart();
  }
  return trimmed;
}

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
