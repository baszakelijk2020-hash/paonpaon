import { z } from "zod";

export const conversationProposalItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  description: z.string().trim().max(1000).optional(),
});

export const createConversationProposalSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  advisorNote: z.string().trim().min(1).max(2000),
  items: z.array(conversationProposalItemSchema).min(1),
  alternatives: z.array(conversationProposalItemSchema).default([]),
  priceMinorUnits: z.number().int().min(0).optional(),
  priceCurrency: z.string().trim().length(3).optional(),
  appointmentOffered: z.boolean().default(false),
  expiresAt: z.string().datetime({ offset: true }),
});
export type CreateConversationProposalInput = z.infer<
  typeof createConversationProposalSchema
>;

export const respondToConversationProposalSchema = z.object({
  proposalId: z.string().uuid(),
  response: z.enum(["accepted", "declined"]),
});
export type RespondToConversationProposalInput = z.infer<
  typeof respondToConversationProposalSchema
>;
