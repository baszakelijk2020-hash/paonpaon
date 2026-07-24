import { z } from "zod";

import type { CurrencyCode } from "../shared/money";

import {
  DEFAULT_RETAILER_BRAND_THEME,
  type RetailerBrandTheme,
} from "./retailer";

export const CURRENCY_CODES = [
  "USD",
  "EUR",
  "GBP",
  "CHF",
  "JPY",
  "AED",
  "HKD",
  "SGD",
] as const satisfies readonly CurrencyCode[];

export const currencyCodeSchema = z.enum(CURRENCY_CODES);

export const retailerTierSchema = z.enum(["boutique", "house", "maison"]);

const httpsAssetSchema = z
  .union([
    z.string().trim().url().startsWith("https://").max(1000),
    z.literal(""),
  ])
  .optional()
  .transform((value) => value || undefined);

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color")
  .transform((value) => value.toLowerCase());

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * (channels[0] ?? 0) +
    0.7152 * (channels[1] ?? 0) +
    0.0722 * (channels[2] ?? 0)
  );
}

export function colorContrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export const retailerBrandThemeSchema = z
  .object({
    logoUrl: httpsAssetSchema,
    faviconUrl: httpsAssetSchema,
    heroImageUrl: httpsAssetSchema,
    accentColor: hexColorSchema,
    surfaceColor: hexColorSchema,
    inkColor: hexColorSchema,
    displayFont: z.enum(["paon_editorial", "heritage", "modern"]),
    bodyFont: z.enum(["quiet_sans", "humanist"]),
    cornerStyle: z.enum(["tailored", "soft", "architectural"]),
  })
  .superRefine((theme, context) => {
    if (colorContrastRatio(theme.surfaceColor, theme.inkColor) < 4.5) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["inkColor"],
        message: "Ink and surface need at least 4.5:1 contrast",
      });
    }
  });

export type RetailerBrandThemeInput = z.infer<typeof retailerBrandThemeSchema>;

export function normalizeRetailerBrandTheme(
  value: unknown,
): RetailerBrandTheme {
  const candidate =
    value && typeof value === "object"
      ? { ...DEFAULT_RETAILER_BRAND_THEME, ...value }
      : DEFAULT_RETAILER_BRAND_THEME;
  const parsed = retailerBrandThemeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_RETAILER_BRAND_THEME;
}

export const addressSchema = z.object({
  line1: z.string().trim().min(1, "Required"),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1, "Required"),
  region: z.string().trim().optional(),
  postalCode: z.string().trim().min(1, "Required"),
  countryCode: z
    .string()
    .trim()
    .length(2, "Use a 2-letter ISO country code")
    .toUpperCase(),
});

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * One PAON Admin form creates the tenant and provisions its first owner
 * together — an onboarded retailer with nobody able to sign in is not
 * a useful intermediate state. See docs/PRODUCT.md "PAON Admin".
 */
export const createRetailerInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(60)
    .regex(slugPattern, "Lowercase letters, numbers and hyphens only"),
  tier: retailerTierSchema,
  defaultCurrency: currencyCodeSchema,
  defaultLocale: z.string().trim().min(2).max(10),
  billingAddress: addressSchema,
  ownerFullName: z.string().trim().min(2).max(120),
  ownerEmail: z.string().trim().toLowerCase().email(),
});

export type CreateRetailerInput = z.infer<typeof createRetailerInputSchema>;

/**
 * Fields a retailer's own owner/admin may edit from Retailer Portal
 * settings — deliberately excludes `slug`, `tier`, `status` and
 * `defaultCurrency`, which stay platform-controlled. See
 * docs/DECISIONS.md ADR-012 and the RLS trigger it documents.
 */
export const updateRetailerProfileInputSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(120),
  primaryDomain: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => value || undefined),
  defaultLocale: z.string().trim().min(2).max(10),
  billingAddress: addressSchema,
});

export type UpdateRetailerProfileInput = z.infer<
  typeof updateRetailerProfileInputSchema
>;
