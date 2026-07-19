import { z } from "zod";

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1).max(140),
    description: z.string().trim().min(1).max(5000),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    venueName: z.string().trim().min(1).max(200),
    venueAddress: z.string().trim().max(500).optional(),
    visibility: z.enum(["public", "invite_only", "vip_tier"]),
    capacity: z.coerce.number().int().positive().max(100_000).optional(),
  })
  .refine((value) => value.startsAt < value.endsAt, {
    message: "End must be after start",
    path: ["endsAt"],
  });

export const updateEventStatusSchema = z.enum([
  "draft",
  "published",
  "cancelled",
  "completed",
]);
export const eventRsvpSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(["attending", "declined"]),
});
