import { z } from "zod";

import type { RetailerRole } from "./role";

export const RETAILER_ROLES = [
  "read_only",
  "production_staff",
  "sales_associate",
  "manager",
  "admin",
  "owner",
] as const satisfies readonly RetailerRole[];

export const retailerRoleSchema = z.enum(RETAILER_ROLES);

/** Provisioning the first owner is folded into retailer creation — see retailer.schema.ts. */
export const inviteRetailerStaffInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: retailerRoleSchema,
});

export type InviteRetailerStaffInput = z.infer<
  typeof inviteRetailerStaffInputSchema
>;
