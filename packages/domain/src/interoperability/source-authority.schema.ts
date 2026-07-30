import { z } from "zod";

import {
  RECONCILIATION_STATES,
  SOURCE_AUTHORITY_MODES,
  SOURCE_DOMAINS,
  SYNC_DIRECTIONS,
} from "./source-authority";

export const sourceAuthorityPolicyDraftSchema = z.object({
  domain: z.enum(SOURCE_DOMAINS),
  fieldGroup: z.string().min(1).max(120),
  authorityMode: z.enum(SOURCE_AUTHORITY_MODES),
  allowedDirections: z
    .array(z.enum(SYNC_DIRECTIONS))
    .min(1)
    .refine((dirs) => new Set(dirs).size === dirs.length, {
      message: "Allowed directions must be unique",
    }),
  connectionId: z.string().uuid().optional(),
});

export const externalIdentityUpsertSchema = z.object({
  connectionId: z.string().uuid(),
  domain: z.enum(SOURCE_DOMAINS),
  externalObjectType: z.string().min(1).max(80),
  externalId: z.string().min(1).max(200),
  canonicalType: z.string().min(1).max(80),
  canonicalId: z.string().uuid(),
  externalVersion: z.string().min(1).max(120),
  mappingVersion: z.string().min(1).max(80),
});

export const sourceSnapshotRecordSchema = z.object({
  connectionId: z.string().uuid(),
  providerEventId: z.string().min(1).max(200),
  payloadHash: z.string().min(8).max(128),
  rawPayload: z.record(z.unknown()),
});

export const reconciliationRecordSchema = z.object({
  externalIdentityId: z.string().uuid(),
  state: z.enum(RECONCILIATION_STATES),
  conflictReason: z.string().max(500).optional(),
});
