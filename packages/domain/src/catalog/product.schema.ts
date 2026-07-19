import { z } from "zod";

import { currencyCodeSchema } from "../retailer/retailer.schema";

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createCollectionInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(slugPattern, "Lowercase letters, numbers and hyphens only"),
  season: z.string().trim().max(60).optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionInputSchema>;

export const productStatusSchema = z.enum(["draft", "active", "archived"]);

export const createProductInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(100)
    .regex(slugPattern, "Lowercase letters, numbers and hyphens only"),
  description: z.string().trim().max(4000).default(""),
  status: productStatusSchema.default("draft"),
  isMadeToOrder: z.boolean().default(false),
  isAlterable: z.boolean().default(false),
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

/**
 * A Product never has a price of its own — see `@paon/domain`
 * `catalog/product.ts` "Product" — so creating one always creates its
 * first sellable variant in the same submission, the same "no useless
 * intermediate state" reasoning as `createRetailerInputSchema` folding
 * in the first owner (docs/DECISIONS.md, retailer.schema.ts).
 */
export const createProductVariantInputSchema = z.object({
  sku: z.string().trim().min(1).max(64),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  priceAmountMinorUnits: z.coerce.number().int().min(0),
  priceCurrency: currencyCodeSchema,
  compareAtPriceAmountMinorUnits: z.coerce.number().int().min(0).optional(),
  inventoryQuantity: z.coerce.number().int().min(0).default(0),
  leadTimeDays: z.coerce.number().int().min(0).optional(),
});

export type CreateProductVariantInput = z.infer<
  typeof createProductVariantInputSchema
>;
