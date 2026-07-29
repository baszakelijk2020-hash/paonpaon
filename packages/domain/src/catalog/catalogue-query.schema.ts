import { z } from "zod";

import { CATALOGUE_FACET_KINDS } from "./catalogue-query";

export const catalogueFacetKindSchema = z.enum(CATALOGUE_FACET_KINDS);

export const catalogueSearchSortSchema = z.enum([
  "newest",
  "price_asc",
  "price_desc",
  "relevance",
]);

export const catalogueSearchRangesSchema = z
  .object({
    minWeight: z.number().finite().positive().max(2000).optional(),
    maxWeight: z.number().finite().positive().max(2000).optional(),
    minPriceMinor: z.number().int().min(0).optional(),
    maxPriceMinor: z.number().int().min(0).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minWeight !== undefined &&
      value.maxWeight !== undefined &&
      value.minWeight > value.maxWeight
    ) {
      ctx.addIssue({
        code: "custom",
        message: "minWeight must be <= maxWeight",
        path: ["minWeight"],
      });
    }
    if (
      value.minPriceMinor !== undefined &&
      value.maxPriceMinor !== undefined &&
      value.minPriceMinor > value.maxPriceMinor
    ) {
      ctx.addIssue({
        code: "custom",
        message: "minPriceMinor must be <= maxPriceMinor",
        path: ["minPriceMinor"],
      });
    }
  });

export const catalogueSearchRequestSchema = z.object({
  retailerId: z.string().uuid(),
  query: z.string().trim().max(500).optional(),
  conceptIds: z.array(z.string().uuid()).max(40).optional(),
  ranges: catalogueSearchRangesSchema.optional(),
  sort: catalogueSearchSortSchema.default("newest"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(24),
});

export type CatalogueSearchRequestInput = z.infer<
  typeof catalogueSearchRequestSchema
>;
