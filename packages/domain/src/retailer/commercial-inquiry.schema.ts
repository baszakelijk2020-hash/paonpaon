import { z } from "zod";

import { COMMERCIAL_INQUIRY_TYPES } from "./commercial-inquiry";

export const commercialInquiryInputSchema = z.object({
  inquiryType: z.enum(COMMERCIAL_INQUIRY_TYPES),
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  websiteUrl: z
    .union([z.string().trim().url().max(500), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  objective: z.string().trim().min(10).max(2000),
  requestedPlanKey: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || undefined),
});

export type CommercialInquiryInputValues = z.infer<
  typeof commercialInquiryInputSchema
>;
