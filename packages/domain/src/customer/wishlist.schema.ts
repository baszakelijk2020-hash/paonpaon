import { z } from "zod";

export const toggleWishlistItemInputSchema = z.object({
  retailerId: z.string().uuid(),
  productVariantId: z.string().uuid(),
});

export type ToggleWishlistItemInput = z.infer<
  typeof toggleWishlistItemInputSchema
>;
