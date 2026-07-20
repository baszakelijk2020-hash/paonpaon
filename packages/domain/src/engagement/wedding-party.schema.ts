import { z } from "zod";

import {
  WEDDING_PARTY_MEMBER_ROLES,
  WEDDING_PARTY_STATUSES,
} from "./wedding-party";

export const createWeddingPartySchema = z.object({
  organizerCustomerId: z.string().uuid(),
  eventDate: z.string().optional(),
  venueName: z.string().trim().min(1).max(200).optional(),
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
