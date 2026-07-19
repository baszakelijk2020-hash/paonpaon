import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});
export const startCustomerConversationSchema = z.object({
  retailerId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});
export const startStaffConversationSchema = z.object({
  customerId: z.string().uuid(),
  body: z.string().trim().min(1).max(5000),
});
