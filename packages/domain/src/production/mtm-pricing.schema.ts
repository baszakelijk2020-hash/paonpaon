import { z } from "zod";

import { MTM_PRICE_COMPONENT_CATEGORIES } from "./mtm-pricing";

export const mtmPriceComponentCategorySchema = z.enum(
  MTM_PRICE_COMPONENT_CATEGORIES,
);

/** Slug is the stable reference a quote/order points at — lowercase,
 * underscore-separated, never blank. displayName is freely renameable. */
export const createMtmPriceComponentSchema = z.object({
  category: mtmPriceComponentCategorySchema,
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9_]+$/,
      "slug must be lowercase, digits and underscores only",
    ),
  displayName: z.string().trim().min(1).max(120),
  priceImpactMinorUnits: z.number().int(),
  currency: z.enum(["USD", "EUR", "GBP", "CHF", "JPY", "AED", "HKD", "SGD"]),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type CreateMtmPriceComponentInput = z.infer<
  typeof createMtmPriceComponentSchema
>;

export const updateMtmPriceComponentSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  priceImpactMinorUnits: z.number().int().optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});
export type UpdateMtmPriceComponentInput = z.infer<
  typeof updateMtmPriceComponentSchema
>;

export const mtmPriceQuoteSelectionSchema = z.object({
  fabricTierComponentId: z.string().min(1),
  garmentScopeComponentId: z.string().min(1),
  makeMethodComponentId: z.string().min(1).optional(),
  rushFeeComponentId: z.string().min(1).optional(),
  designOptionComponentIds: z.array(z.string().min(1)).default([]),
});
