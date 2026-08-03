import { z } from "zod";

export const createMicroCapsuleDropInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  theme: z.string().trim().min(1).max(300).optional(),
  weekStart: z.string().date(),
  productIds: z.array(z.string().uuid()).min(1).max(12),
});
export type CreateMicroCapsuleDropInput = z.infer<
  typeof createMicroCapsuleDropInputSchema
>;
