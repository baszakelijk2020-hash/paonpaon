import { z } from "zod";

import {
  WEDDING_PARTY_MEMBER_ROLES,
  WEDDING_PARTY_STATUSES,
} from "./wedding-party";

const eventTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Use a valid time (HH:MM)")
  .optional();

export const createWeddingPartySchema = z.object({
  organizerCustomerId: z.string().uuid(),
  eventDate: z.string().optional(),
  eventTime: eventTimeSchema,
  venueName: z.string().trim().min(1).max(200).optional(),
  fittingLocation: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateWeddingPartyStatusSchema = z.object({
  weddingPartyId: z.string().uuid(),
  status: z.enum(WEDDING_PARTY_STATUSES as [string, ...string[]]),
});

export const addWeddingPartyMemberSchema = z.object({
  weddingPartyId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  role: z.enum(WEDDING_PARTY_MEMBER_ROLES as [string, ...string[]]),
});

/** Anonymous join-link onboarding — identity plus party-scoped prep
 * (ADR-055). Photo is validated in the Server Action as a File. */
export const joinWeddingPartySchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email(),
  role: z.enum(WEDDING_PARTY_MEMBER_ROLES as [string, ...string[]]),
  heightCm: z.coerce.number().min(100).max(250),
  weightKg: z.coerce.number().min(30).max(300),
});
