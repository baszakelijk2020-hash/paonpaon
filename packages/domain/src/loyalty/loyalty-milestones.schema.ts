import { z } from "zod";

import {
  LOYALTY_BUILT_IN_MILESTONE_KINDS,
  LOYALTY_MILESTONE_KINDS,
  LOYALTY_MILESTONE_POINTS_CAP,
} from "./loyalty-milestones";

const uuidSchema = z.string().uuid();

export const loyaltyMilestoneDefinitionSchema = z
  .object({
    kind: z.enum(LOYALTY_MILESTONE_KINDS),
    customKey: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    label: z.string().trim().min(1).max(120),
    explanation: z.string().trim().min(1).max(500),
    points: z.coerce
      .number()
      .int()
      .positive()
      .max(LOYALTY_MILESTONE_POINTS_CAP),
    matchConceptIds: z.array(uuidSchema).max(40).default([]),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "custom" && !value.customKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customKey"],
        message: "Custom peer milestones require a stable key",
      });
    }
    if (value.kind !== "custom" && value.customKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customKey"],
        message: "Built-in milestones cannot carry a custom key",
      });
    }
    if (
      value.kind === "custom" &&
      value.matchConceptIds.length === 0 &&
      value.active
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["matchConceptIds"],
        message: "Active peer milestones must match at least one concept",
      });
    }
  });

export type LoyaltyMilestoneDefinitionInput = z.infer<
  typeof loyaltyMilestoneDefinitionSchema
>;

export const upsertBuiltInMilestonePointsSchema = z.object({
  kind: z.enum(LOYALTY_BUILT_IN_MILESTONE_KINDS),
  points: z.coerce.number().int().positive().max(LOYALTY_MILESTONE_POINTS_CAP),
  active: z.boolean().default(true),
  matchConceptIds: z.array(uuidSchema).max(40).optional(),
});

export type UpsertBuiltInMilestonePointsInput = z.infer<
  typeof upsertBuiltInMilestonePointsSchema
>;
