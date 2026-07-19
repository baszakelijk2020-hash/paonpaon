import { z } from "zod";

import type { AlterationStatus } from "./production";

export const ALTERATION_STATUSES = [
  "requested",
  "measured",
  "in_progress",
  "ready_for_fitting",
  "ready_for_pickup",
  "complete",
] as const satisfies readonly AlterationStatus[];

export const alterationStatusSchema = z.enum(ALTERATION_STATUSES);

/**
 * Retailer Portal: create an alteration for a customer, optionally
 * attached to an order line (docs/PRODUCT.md "Order vs. Production vs.
 * Alteration" — an alteration may instead stand alone, on a past
 * purchase, hence `orderLineId` is optional here too).
 */
export const createAlterationInputSchema = z.object({
  customerId: z.string().uuid(),
  orderLineId: z.string().uuid().optional(),
  instructions: z.string().trim().min(1).max(2000),
  dueDate: z.string().date().optional(),
});

export type CreateAlterationInput = z.infer<typeof createAlterationInputSchema>;

/**
 * Adding an update always (optionally) advances status and always may
 * carry a note — the two are independent (`status` unset means "just a
 * note," `note` unset means "just a status change").
 */
export const addAlterationUpdateInputSchema = z.object({
  status: alterationStatusSchema,
  note: z.string().trim().max(2000).optional(),
});

export type AddAlterationUpdateInput = z.infer<
  typeof addAlterationUpdateInputSchema
>;
