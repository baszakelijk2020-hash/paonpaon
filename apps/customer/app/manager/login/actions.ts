"use server";

import { z } from "zod";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const requestMagicLinkInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export interface RequestManagerMagicLinkFormState {
  email?: string;
  fieldErrors: Record<string, string>;
  formError?: string;
  sent: boolean;
}

/** Same `signInWithOtp` mechanism as the shopper login and employee login
 * (`app/login/actions.ts`'s `requestMagicLink` and employee's
 * `requestEmployeeMagicLink`) — only the redirect target differs, so a
 * manager lands on `/manager/auth/confirm`, never the customer or
 * employee confirm route. */
export async function requestManagerMagicLink(
  _prevState: RequestManagerMagicLinkFormState,
  formData: FormData,
): Promise<RequestManagerMagicLinkFormState> {
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
      emailRedirectTo: `${env.appUrl}/manager/auth/confirm?next=${encodeURIComponent("/manager")}`,
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
