import { z } from "zod";

import {
  CONSENT_BASES,
  CONSENT_PURPOSES,
  CONSENT_STATUSES,
  type ConsentSnapshot,
  type ConsentStatus,
} from "./consent";
import {
  INTERACTION_EVENT_NAMES,
  INTERACTION_EVENT_SOURCES,
  RETENTION_CLASSES,
} from "./interaction-event";

export const consentPurposeSchema = z.enum(CONSENT_PURPOSES);
export const consentStatusSchema = z.enum(CONSENT_STATUSES);
export const consentBasisSchema = z.enum(CONSENT_BASES);

export const consentSnapshotSchema = z.object({
  personalization: consentStatusSchema,
  marketing: consentStatusSchema,
  location: consentStatusSchema,
  capturedAt: z.string().datetime({ offset: true }),
  basis: consentBasisSchema,
});

export type ConsentSnapshotInput = z.infer<typeof consentSnapshotSchema>;

export const setCustomerConsentInputSchema = z.object({
  purpose: consentPurposeSchema,
  status: z.enum([
    "granted",
    "denied",
    "withdrawn",
  ] as const satisfies readonly ConsentStatus[]),
  reason: z.string().trim().max(500).optional(),
});

export type SetCustomerConsentInput = z.infer<
  typeof setCustomerConsentInputSchema
>;

export const interactionEventNameSchema = z.enum(INTERACTION_EVENT_NAMES);
export const interactionEventSourceSchema = z.enum(INTERACTION_EVENT_SOURCES);
export const retentionClassSchema = z.enum(RETENTION_CLASSES);

export const captureInteractionEventInputSchema = z.object({
  retailerId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  anonymousSessionId: z.string().uuid().optional(),
  name: interactionEventNameSchema,
  properties: z.record(z.string(), z.unknown()).default({}),
  occurredAt: z.string().datetime({ offset: true }),
  source: interactionEventSourceSchema,
  purpose: consentPurposeSchema.default("personalization"),
  consentBasis: consentBasisSchema,
  consentSnapshot: consentSnapshotSchema,
  retentionClass: retentionClassSchema.default("personalization_signal"),
  retentionDays: z.number().int().positive().max(3650).optional(),
});

export type CaptureInteractionEventSchemaInput = z.infer<
  typeof captureInteractionEventInputSchema
>;

export function parseConsentSnapshot(value: unknown): ConsentSnapshot {
  return consentSnapshotSchema.parse(value);
}
