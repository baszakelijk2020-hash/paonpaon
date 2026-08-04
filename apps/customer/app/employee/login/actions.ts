"use server";

import { z } from "zod";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const requestMagicLinkInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export interface RequestEmployeeMagicLinkFormState {
  email?: string;
  fieldErrors: Record<string, string>;
  formError?: string;
  sent: boolean;
}

/** Same `signInWithOtp` mechanism as the shopper login
 * (`app/login/actions.ts`'s `requestMagicLink`) — only the redirect
 * target differs, so a wearer lands on `/employee/auth/confirm`, never
 * the customer confirm route. */
export async function requestEmployeeMagicLink(
  _prevState: RequestEmployeeMagicLinkFormState,
  formData: FormData,
): Promise<RequestEmployeeMagicLinkFormState> {
  const parsed = requestMagicLinkInputSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      fieldErrors: { email: "Enter a valid email address." },
      sent: false,
    };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${env.appUrl}/employee/auth/confirm?next=${encodeURIComponent("/employee")}`,
    },
  });

  if (error) {
    return {
      email: parsed.data.email,
      fieldErrors: {},
      formError: error.message,
      sent: false,
    };
  }

  return { email: parsed.data.email, fieldErrors: {}, sent: true };
}
