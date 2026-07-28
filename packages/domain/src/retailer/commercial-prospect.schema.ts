import { z } from "zod";

import { DEMO_PRODUCT_MIX } from "./commercial-prospect";
import { retailerBrandThemeSchema } from "./retailer.schema";

const optionalHttpsUrl = z
  .union([
    z.string().trim().url().startsWith("https://").max(1000),
    z.literal(""),
  ])
  .optional()
  .transform((value) => value || undefined);

export const createCommercialProspectInputSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: optionalHttpsUrl,
  primaryContactName: z.string().trim().min(2).max(160),
  primaryContactEmail: z.string().trim().toLowerCase().email().max(320),
  primaryContactPhone: z
    .string()
    .trim()
    .max(50)
    .optional()
    .transform((value) => value || undefined),
  source: z.string().trim().min(2).max(80),
  salesNotes: z.string().trim().max(4000),
  observedOpportunities: z.array(z.string().trim().min(2).max(240)).max(12),
  recommendedPlanId: z.string().uuid().optional(),
  nextAction: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((value) => value || undefined),
  nextActionDueAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined),
});

export const saveProspectDemoConfigurationInputSchema = z.object({
  prospectId: z.string().uuid(),
  planId: z.string().uuid(),
  theme: retailerBrandThemeSchema,
  marketingHeadline: z.string().trim().min(8).max(180),
  personalizedIntroduction: z.string().trim().min(20).max(2000),
  locations: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        city: z.string().trim().min(2).max(120),
        imageUrl: optionalHttpsUrl,
      }),
    )
    .min(1)
    .max(25),
  productMix: z.array(z.enum(DEMO_PRODUCT_MIX)).min(1),
  productImageUrls: z
    .array(z.string().trim().url().startsWith("https://").max(1000))
    .max(24)
    .default([]),
  featureKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
  changeNote: z.string().trim().min(2).max(240),
});
