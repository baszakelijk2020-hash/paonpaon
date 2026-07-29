import { z } from "zod";

import {
  MORNING_ROUTINE_DELIVERY_CHANNELS,
  MORNING_ROUTINE_DELIVERY_FREQUENCIES,
} from "./morning-routine-delivery";

export const morningRoutineDeliveryFrequencySchema = z.enum(
  MORNING_ROUTINE_DELIVERY_FREQUENCIES,
);
export const morningRoutineDeliveryChannelSchema = z.enum(
  MORNING_ROUTINE_DELIVERY_CHANNELS,
);

export const upsertMorningRoutineSubscriptionInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid(),
  deliveryOptIn: z.boolean(),
  frequency: morningRoutineDeliveryFrequencySchema,
  channels: z
    .array(morningRoutineDeliveryChannelSchema)
    .min(1)
    .max(2)
    .refine(
      (channels) => new Set(channels).size === channels.length,
      "Duplicate channels are not allowed.",
    ),
  timezone: z.string().trim().min(1).max(80),
  deliveryHourLocal: z.number().int().min(0).max(23),
  quietStartHour: z.number().int().min(0).max(23).nullable(),
  quietEndHour: z.number().int().min(0).max(23).nullable(),
  weeklyAnchorDow: z.number().int().min(0).max(6).default(1),
});

export type UpsertMorningRoutineSubscriptionInput = z.infer<
  typeof upsertMorningRoutineSubscriptionInputSchema
>;

export const upsertMorningRoutineRetailerSettingsInputSchema = z.object({
  retailerId: z.string().uuid(),
  enabled: z.boolean(),
  deliveryHourLocal: z.number().int().min(0).max(23),
  eligibleProductIds: z.array(z.string().uuid()).max(500),
});

export type UpsertMorningRoutineRetailerSettingsInput = z.infer<
  typeof upsertMorningRoutineRetailerSettingsInputSchema
>;

export const morningRoutineUnsubscribeInputSchema = z.object({
  token: z.string().trim().min(16).max(200),
});

export type MorningRoutineUnsubscribeInput = z.infer<
  typeof morningRoutineUnsubscribeInputSchema
>;
