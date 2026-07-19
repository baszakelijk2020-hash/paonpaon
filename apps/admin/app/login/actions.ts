"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const signInInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  redirectTo: z.string().startsWith("/").optional(),
});

export async function signIn(formData: FormData): Promise<void> {
  const parsed = signInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  redirect(parsed.data.redirectTo ?? "/retailers");
}
