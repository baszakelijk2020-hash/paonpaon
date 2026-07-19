import { z } from "zod";

export const loyaltyProgramSchema = z.object({
  name: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  pointsPerCurrencyUnit: z.coerce.number().int().min(0).max(1000),
  referralPoints: z.coerce.number().int().min(0).max(1_000_000),
});

export const rewardSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["discount_percent", "discount_fixed", "gift", "early_access"]),
  pointsCost: z.coerce.number().int().positive().max(10_000_000),
  minimumTier: z.enum(["member", "silver", "gold", "platinum"]).optional(),
});

export const referralInviteSchema = z.object({
  retailerId: z.string().uuid(),
  referredEmail: z.string().trim().email(),
});
