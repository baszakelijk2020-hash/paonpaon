import { z } from "zod";

import {
  CATALOGUE_IMPORT_CATEGORY_COLUMNS,
  type CatalogueImportCategoryColumn,
} from "./import-contract";

export const catalogueImportEnrichmentInferenceSourceSchema = z.enum([
  "supplier_text",
  "derived",
  "inferred",
]);

export const catalogueImportEnrichmentTaxonomyMappingSchema = z.object({
  field: z.enum(
    CATALOGUE_IMPORT_CATEGORY_COLUMNS as unknown as [
      CatalogueImportCategoryColumn,
      ...CatalogueImportCategoryColumn[],
    ],
  ),
  conceptSlug: z.string().trim().min(1).max(120),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .refine(
      (value) => Number.isInteger(value * 10_000),
      "Confidence supports at most 4 decimal places",
    ),
  source: catalogueImportEnrichmentInferenceSourceSchema,
  evidence: z.string().trim().min(1).max(1000),
});

export const catalogueImportEnrichmentDerivedSuitabilitySchema = z.object({
  field: z.enum(
    CATALOGUE_IMPORT_CATEGORY_COLUMNS as unknown as [
      CatalogueImportCategoryColumn,
      ...CatalogueImportCategoryColumn[],
    ],
  ),
  value: z.string().trim().min(1).max(200),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .refine(
      (value) => Number.isInteger(value * 10_000),
      "Confidence supports at most 4 decimal places",
    ),
  source: z.enum(["derived", "inferred"]),
  evidence: z.string().trim().min(1).max(1000),
});

export const catalogueImportEnrichmentProposalSchema = z.object({
  taxonomyMappings: z
    .array(catalogueImportEnrichmentTaxonomyMappingSchema)
    .max(30),
  derivedSuitability: z
    .array(catalogueImportEnrichmentDerivedSuitabilitySchema)
    .max(20),
});

export type CatalogueImportEnrichmentProposalParsed = z.infer<
  typeof catalogueImportEnrichmentProposalSchema
>;
