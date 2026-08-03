import { z } from "zod";

import {
  CORPORATE_EXCEPTION_KINDS,
  ENTITLEMENT_PERIODS,
  LEAVER_ACTIONS,
} from "./corporate-programme";

export const entitlementPeriodSchema = z.enum(ENTITLEMENT_PERIODS);
export const corporateExceptionKindSchema = z.enum(CORPORATE_EXCEPTION_KINDS);
export const leaverActionSchema = z.enum(LEAVER_ACTIONS);

export const entitlementRuleInputSchema = z.object({
  roleKey: z.string().trim().min(1).max(64),
  garmentKey: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1),
  period: entitlementPeriodSchema,
});

export const createCorporateAccountInputSchema = z.object({
  legalName: z.string().trim().min(2).max(300),
  accountReference: z.string().trim().min(1).max(64),
});
export type CreateCorporateAccountInput = z.infer<
  typeof createCorporateAccountInputSchema
>;

export const createCorporateProgrammeInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  siteKeys: z.array(z.string().trim().min(1).max(64)).default([]),
});
export type CreateCorporateProgrammeInput = z.infer<
  typeof createCorporateProgrammeInputSchema
>;

export const createCorporateEntitlementVersionInputSchema = z.object({
  programmeId: z.string().uuid(),
  effectiveFrom: z.string().date(),
  rules: z.array(entitlementRuleInputSchema).min(1),
});
export type CreateCorporateEntitlementVersionInput = z.infer<
  typeof createCorporateEntitlementVersionInputSchema
>;

export const createCorporateWearerInputSchema = z.object({
  programmeId: z.string().uuid(),
  employeeReference: z.string().trim().min(1).max(64),
  displayName: z.string().trim().min(1).max(200),
  roleKey: z.string().trim().min(1).max(64),
  siteKey: z.string().trim().min(1).max(64).optional(),
  joinedOn: z.string().date(),
  garmentAdaptationNote: z.string().trim().min(1).max(500).optional(),
});
export type CreateCorporateWearerInput = z.infer<
  typeof createCorporateWearerInputSchema
>;

export const recordCorporateIssueInputSchema = z.object({
  wearerId: z.string().uuid(),
  entitlementVersionId: z.string().uuid(),
  garmentKey: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1),
  issuedOn: z.string().date(),
  orderId: z.string().uuid().optional(),
});
export type RecordCorporateIssueInput = z.infer<
  typeof recordCorporateIssueInputSchema
>;

export const createCorporateExceptionInputSchema = z.object({
  programmeId: z.string().uuid(),
  wearerId: z.string().uuid().optional(),
  kind: corporateExceptionKindSchema,
  garmentKey: z.string().trim().min(1).max(120).optional(),
  quantity: z.number().int().min(1).optional(),
  action: leaverActionSchema.optional(),
  detail: z.string().trim().min(5).max(2000),
});
export type CreateCorporateExceptionInput = z.infer<
  typeof createCorporateExceptionInputSchema
>;
