import { z } from "zod";

import { METADATA_CONCEPT_KINDS } from "../metadata/metadata.schema";

export const catalogueSearchSortSchema = z.enum([
  "newest",
  "price_asc",
  "price_desc",
  "relevance",
]);

export type CatalogueSearchSort = z.infer<typeof catalogueSearchSortSchema>;

export const catalogueSearchRangesSchema = z
  .object({
    minWeight: z.number().positive().max(2000).optional(),
    maxWeight: z.number().positive().max(2000).optional(),
    minPriceMinor: z.number().int().min(0).optional(),
    maxPriceMinor: z.number().int().min(0).optional(),
  })
  .refine(
    (ranges) =>
      ranges.minWeight === undefined ||
      ranges.maxWeight === undefined ||
      ranges.minWeight <= ranges.maxWeight,
    { message: "minWeight cannot exceed maxWeight" },
  )
  .refine(
    (ranges) =>
      ranges.minPriceMinor === undefined ||
      ranges.maxPriceMinor === undefined ||
      ranges.minPriceMinor <= ranges.maxPriceMinor,
    { message: "minPriceMinor cannot exceed maxPriceMinor" },
  );

export type CatalogueSearchRanges = z.infer<
  typeof catalogueSearchRangesSchema
>;

export const catalogueSearchRequestSchema = z.object({
  retailerId: z.string().uuid(),
  query: z.string().trim().max(500).optional(),
  conceptIds: z.array(z.string().uuid()).max(32).optional(),
  ranges: catalogueSearchRangesSchema.optional(),
  sort: catalogueSearchSortSchema.default("newest"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(48),
});

export type CatalogueSearchRequestInput = z.input<
  typeof catalogueSearchRequestSchema
>;

export const CATALOGUE_FACET_KINDS = [
  "mill",
  "weave",
  "weight",
  "performance",
  "climate",
  "season",
  "pattern",
  "construction",
  "occasion",
  "formality",
  "colour",
  "price",
] as const;

export type CatalogueFacetKind = (typeof CATALOGUE_FACET_KINDS)[number];

/** SRCH-001 facet kinds that map directly to metadata concept kinds. */
export const CATALOGUE_FACET_TO_CONCEPT_KIND = {
  mill: "mill",
  weave: "weave",
  performance: "performance",
  climate: "climate",
  season: "season",
  pattern: "pattern",
  construction: "construction",
  occasion: "occasion",
  formality: "formality",
  colour: "colour",
} as const satisfies Record<
  Exclude<CatalogueFacetKind, "weight" | "price">,
  (typeof METADATA_CONCEPT_KINDS)[number]
>;
