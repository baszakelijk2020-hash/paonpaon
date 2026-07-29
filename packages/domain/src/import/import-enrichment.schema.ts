import { z } from "zod";

import {
  IMPORT_ENRICHMENT_PROPOSABLE_FIELDS,
  IMPORT_ENRICHMENT_PROMPT_SLUG,
  IMPORT_ENRICHMENT_SCHEMA_VERSION,
  type ImportEnrichmentProposableField,
} from "./import-enrichment";

export const importEnrichmentProposableFieldSchema = z.enum(
  IMPORT_ENRICHMENT_PROPOSABLE_FIELDS as unknown as [
    ImportEnrichmentProposableField,
    ...ImportEnrichmentProposableField[],
  ],
);

export const importEnrichmentFieldProposalSchema = z.object({
  field: importEnrichmentProposableFieldSchema,
  proposedValue: z.string().trim().min(1).max(500),
  mappedConceptSlug: z.string().trim().min(1).max(120).optional(),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .refine(
      (value) => Number.isInteger(value * 10_000),
      "Confidence supports at most 4 decimal places",
    ),
  evidence: z.string().trim().min(1).max(1000),
  source: z.literal("ai"),
});

export const importEnrichmentModelOutputSchema = z.object({
  proposals: z.array(
    z.object({
      field: z.string().trim().min(1).max(80),
      proposedValue: z.string().trim().min(1).max(500),
      mappedConceptSlug: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .nullable()
        .optional(),
      confidence: z.number(),
      evidence: z.string().trim().min(1).max(1000),
    }),
  ),
});

export type ImportEnrichmentModelOutput = z.infer<
  typeof importEnrichmentModelOutputSchema
>;

export const updateImportEnrichmentPromptInputSchema = z.object({
  slug: z.string().trim().min(1).max(80).default(IMPORT_ENRICHMENT_PROMPT_SLUG),
  title: z.string().trim().min(1).max(200),
  promptMarkdown: z.string().trim().min(40).max(50_000),
  responseSchemaVersion: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .default(IMPORT_ENRICHMENT_SCHEMA_VERSION),
  active: z.boolean().default(true),
});

export type UpdateImportEnrichmentPromptInput = z.infer<
  typeof updateImportEnrichmentPromptInputSchema
>;

export const applyImportEnrichmentProposalsInputSchema = z.object({
  retailerId: z.string().uuid(),
  importRowId: z.string().uuid(),
  proposals: z.array(importEnrichmentFieldProposalSchema).max(30),
});

export type ApplyImportEnrichmentProposalsInput = z.infer<
  typeof applyImportEnrichmentProposalsInputSchema
>;
