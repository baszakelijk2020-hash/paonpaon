import { z } from "zod";

import type { PlatformRole } from "./role";

export const PLATFORM_ROLES = [
  "platform_owner",
  "platform_admin",
  "support_agent",
  "platform_analyst",
] as const satisfies readonly PlatformRole[];

export const platformRoleSchema = z.enum(PLATFORM_ROLES);

export const invitePlatformStaffInputSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: platformRoleSchema,
});

export type InvitePlatformStaffInput = z.infer<
  typeof invitePlatformStaffInputSchema
>;
