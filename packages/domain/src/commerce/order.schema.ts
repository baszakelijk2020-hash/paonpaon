import { z } from "zod";

import type { OrderStatus } from "./order";

export const ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "placed",
  "in_production",
  "ready_for_fulfillment",
  "shipped",
  "delivered",
  "completed",
  "canceled",
  "refunded",
] as const satisfies readonly OrderStatus[];

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const updateOrderStatusInputSchema = z.object({
  status: orderStatusSchema,
});

export type UpdateOrderStatusInput = z.infer<
  typeof updateOrderStatusInputSchema
>;

/**
 * What a Customer Portal checkout submission needs — everything else
 * (price, currency, inventory check, customer linking) is re-derived
 * server-side inside `place_order`, never trusted from the client. See
 * docs/DECISIONS.md ADR-014.
 */
export const placeOrderInputSchema = z.object({
  retailerId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(20),
});

export type PlaceOrderInput = z.infer<typeof placeOrderInputSchema>;
