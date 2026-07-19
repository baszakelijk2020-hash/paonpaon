"use server";

import { PlatformStaffRepository } from "@paon/database";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const schema = z
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
  _previous: AcceptInviteFormState,
  formData: FormData,
): Promise<AcceptInviteFormState> {
  const session = await getSession();
  if (!session || session.accountType !== "platform") redirect("/login");
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".")] ??= issue.message;
    }
    return { fieldErrors };
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { fieldErrors: {}, formError: error.message };
  try {
    await new PlatformStaffRepository(supabase).acceptInvite(
      parsed.data.staffId,
    );
  } catch (cause) {
    return {
      fieldErrors: {},
      formError: cause instanceof Error ? cause.message : "Invite failed",
    };
  }
  redirect("/retailers");
}
