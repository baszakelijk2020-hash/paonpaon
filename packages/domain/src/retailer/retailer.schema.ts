import { z } from "zod";

import type { CurrencyCode } from "../shared/money";

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
