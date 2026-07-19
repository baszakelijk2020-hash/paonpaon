"use server";

import { z } from "zod";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const requestMagicLinkInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export interface RequestMagicLinkFormState {
  email?: string;
  fieldErrors: Record<string, string>;
  formError?: string;
  sent: boolean;
}

export const initialRequestMagicLinkFormState: RequestMagicLinkFormState = {
  fieldErrors: {},
  sent: false,
};

export async function requestMagicLink(
  _prevState: RequestMagicLinkFormState,
  formData: FormData,
): Promise<RequestMagicLinkFormState> {
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
    options: { emailRedirectTo: `${env.appUrl}/auth/confirm` },
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
