import { z } from "zod";

export const issueConceptScanCodeInputSchema = z.object({
  productVariantId: z.string().uuid(),
  kind: z.enum(["try_on", "fabric_swatch"]),
  expiresAt: z.string().datetime().optional(),
});

export const resolveConceptScanCodeInputSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

export const addConceptScanSelectionInputSchema = z.object({
  code: z.string().trim().min(1).max(64),
});
