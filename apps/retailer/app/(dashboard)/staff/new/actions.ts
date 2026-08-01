"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  RetailerStaffRepository,
  StaffEmailAlreadyInvitedError,
} from "@paon/database";
import {
  asId,
  inviteRetailerStaffInputSchema,
  type UserId,
} from "@paon/domain";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface InviteStaffFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

export async function inviteStaff(
  _prevState: InviteStaffFormState,
  formData: FormData,
): Promise<InviteStaffFormState> {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "admin");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = inviteRetailerStaffInputSchema.safeParse({
    fullName: raw["fullName"],
    email: raw["email"],
    role: raw["role"],
    workshopId: raw["workshopId"] || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  const admin = getSupabaseAdminClient();
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      data: { full_name: parsed.data.fullName },
      redirectTo: `${env.appUrl}/auth/confirm`,
    });

  if (inviteError || !invited.user) {
    return {
      values: raw,
      fieldErrors: {},
      formError: `The invite email failed to send: ${
        inviteError?.message ?? "unknown error"
      }. Try again.`,
    };
  }

  try {
    await new RetailerStaffRepository(admin).create({
      retailerId: session.retailerId,
      userId: invited.user.id as UserId,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      role: parsed.data.role,
      ...(parsed.data.workshopId
        ? { workshopId: asId<"WorkshopId">(parsed.data.workshopId) }
        : {}),
    });
  } catch (error) {
    if (error instanceof StaffEmailAlreadyInvitedError) {
      return { values: raw, fieldErrors: {}, formError: error.message };
    }
    throw error;
  }

  redirect("/staff");
}
