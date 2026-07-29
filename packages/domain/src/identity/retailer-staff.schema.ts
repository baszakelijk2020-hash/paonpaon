import { z } from "zod";

import type { RetailerRole } from "./role";

export const RETAILER_ROLES = [
  "read_only",
  "production_staff",
  "workshop_manager",
  "worker",
  "sales_associate",
  "manager",
  "admin",
  "owner",
] as const satisfies readonly RetailerRole[];

export const retailerRoleSchema = z.enum(RETAILER_ROLES);

export const RETAILER_ROLE_LABELS: Record<RetailerRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Manager",
  sales_associate: "Sales advisor",
  production_staff: "Production specialist",
  workshop_manager: "Workshop manager",
  worker: "Alteration specialist",
  read_only: "Observer",
};

/**
 * Every role an in-portal invite (Retailer Portal "Staff" page, or any
 * future equivalent) may grant — deliberately excludes "owner".
 * Provisioning the first (and only) owner is folded into retailer
 * creation and is exclusively a PAON Admin action — see
 * retailer.schema.ts and docs/DECISIONS.md ADR-009. Without this
 * exclusion, an "admin"-level retailer staff member could grant
 * themselves or anyone else "owner" through the same RLS policy that
 * lets owners/admins manage staff at all
 * (`retailer_staff_members` "retailer owners and admins can manage
 * their retailer's staff").
 */
export const INVITABLE_RETAILER_ROLES = RETAILER_ROLES.filter(
  (role) => role !== "owner",
) as readonly Exclude<RetailerRole, "owner">[];

export const invitableRetailerRoleSchema = z.enum(
  INVITABLE_RETAILER_ROLES as [RetailerRole, ...RetailerRole[]],
);

/** Provisioning the first owner is folded into retailer creation — see retailer.schema.ts. */
export const inviteRetailerStaffInputSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    role: invitableRetailerRoleSchema,
    workshopId: z.string().uuid().optional(),
  })
  .superRefine((value, context) => {
    const workshopRole =
      value.role === "workshop_manager" || value.role === "worker";
    if (workshopRole && !value.workshopId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workshopId"],
        message: "Choose a workshop for workshop staff.",
      });
    }
    if (!workshopRole && value.workshopId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workshopId"],
        message: "Only workshop staff may be linked to a workshop.",
      });
    }
  });

export type InviteRetailerStaffInput = z.infer<
  typeof inviteRetailerStaffInputSchema
>;
