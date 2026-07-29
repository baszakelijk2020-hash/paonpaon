import { z } from "zod";

import { CONSENT_PURPOSES } from "./consent";
import { INTERACTION_EVENT_TYPES } from "./interaction-event";
import { RETENTION_CLASSES } from "./retention";

export const consentPurposeSchema = z.enum(CONSENT_PURPOSES);
export const interactionEventTypeSchema = z.enum(INTERACTION_EVENT_TYPES);
export const retentionClassSchema = z.enum(RETENTION_CLASSES);

export const consentSnapshotSchema = z.object({
  purpose: consentPurposeSchema,
  granted: z.boolean(),
  basis: z.enum([
    "explicit_opt_in",
    "never_granted",
    "withdrawn",
    "legacy_implicit",
  ]),
  recordedAt: z.string().datetime(),
  version: z.literal(1),
});

export const upsertCustomerConsentInputSchema = z.object({
  purpose: consentPurposeSchema,
  granted: z.boolean(),
});

export const interactionEventPropertiesSchema = z.record(z.unknown());
