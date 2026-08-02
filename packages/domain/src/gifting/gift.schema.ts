import { z } from "zod";

export const composeGiftExperienceInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  introMessage: z.string().trim().min(1).max(2000),
  expiresAt: z.string().datetime().optional(),
  productVariantIds: z.array(z.string().uuid()).min(1).max(12),
});

export const sendGiftInvitationInputSchema = z.object({
  giftExperienceId: z.string().uuid(),
  recipientName: z.string().trim().max(200).optional(),
  recipientEmail: z.string().trim().email().max(320).optional(),
});

export const redeemGiftInvitationInputSchema = z.object({
  inviteToken: z.string().uuid(),
  curatedItemId: z.string().uuid(),
  recipientName: z.string().trim().min(1).max(200),
  recipientEmail: z.string().trim().email().max(320),
});
