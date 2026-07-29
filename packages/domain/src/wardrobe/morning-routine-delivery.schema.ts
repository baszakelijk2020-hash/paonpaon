import { z } from "zod";

import {
  MORNING_ROUTINE_DELIVERY_CHANNELS,
  MORNING_ROUTINE_DELIVERY_FREQUENCIES,
  isValidIanaTimezone,
} from "./morning-routine-delivery";

export const morningRoutineDeliveryFrequencySchema = z.enum(
  MORNING_ROUTINE_DELIVERY_FREQUENCIES,
);
export const morningRoutineDeliveryChannelSchema = z.enum(
  MORNING_ROUTINE_DELIVERY_CHANNELS,
);

export const upsertMorningRoutineSubscriptionInputSchema = z
  .object({
    retailerId: z.string().uuid(),
    customerId: z.string().uuid(),
    optedIn: z.boolean(),
    frequency: morningRoutineDeliveryFrequencySchema.default("daily"),
    timezone: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(isValidIanaTimezone, "timezone must be a valid IANA name"),
    preferredLocalHour: z.number().int().min(0).max(23).default(7),
    channels: z
      .array(morningRoutineDeliveryChannelSchema)
      .min(1)
      .max(2)
      .default(["in_app"]),
    quietStartMinute: z.number().int().min(0).max(1439).optional(),
    quietEndMinute: z.number().int().min(0).max(1439).optional(),
  })
  .superRefine((value, ctx) => {
    const hasStart = value.quietStartMinute !== undefined;
    const hasEnd = value.quietEndMinute !== undefined;
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Quiet hours require both start and end minutes.",
        path: ["quietStartMinute"],
      });
    }
  });

export type UpsertMorningRoutineSubscriptionInput = z.infer<
  typeof upsertMorningRoutineSubscriptionInputSchema
>;

export const setMorningRoutineEligibleProductInputSchema = z.object({
  productId: z.string().uuid(),
  active: z.boolean(),
});

export type SetMorningRoutineEligibleProductInput = z.infer<
  typeof setMorningRoutineEligibleProductInputSchema
>;

export const setMorningRoutineRetailerPausedInputSchema = z.object({
  paused: z.boolean(),
});

export type SetMorningRoutineRetailerPausedInput = z.infer<
  typeof setMorningRoutineRetailerPausedInputSchema
>;
