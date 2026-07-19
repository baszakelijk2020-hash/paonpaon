"use server";

import { RetailerStaffRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const acceptInviteInputSchema = z
  .object({
    staffId: z.string().uuid(),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export interface AcceptInviteFormState {
  fieldErrors: Record<string, string>;
  formError?: string;
}

export async function acceptInvite(
  _prevState: AcceptInviteFormState,
  formData: FormData,
): Promise<AcceptInviteFormState> {
  const session = await getSession();
  if (!session || session.accountType !== "retailer_staff") {
    redirect("/login");
  }

  const parsed = acceptInviteInputSchema.safeParse({
    staffId: formData.get("staffId"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await getSupabaseServerClient();

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (updateError) {
    return { fieldErrors: {}, formError: updateError.message };
  }

  try {
    await new RetailerStaffRepository(supabase).acceptInvite(
      asId<"StaffId">(parsed.data.staffId),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      fieldErrors: {},
      formError: `Password set, but finishing onboarding failed: ${message}. Try signing in again.`,
    };
  }

  redirect("/dashboard");
}
