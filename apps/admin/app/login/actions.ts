"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const signInInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  redirectTo: z.string().startsWith("/").optional(),
});

/** Seeded demo persona addresses (see packages/database/src/demo-seed.ts). */
const DEMO_EMAIL_PATTERN = /^contact(\+[^@]+)?@nebelspiegel\.com$/i;

const isRealProduction =
  process.env["VERCEL_ENV"] === "production" ||
  (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");

export async function signIn(formData: FormData): Promise<void> {
  const parsed = signInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=invalid_input");
  }

  if (isRealProduction && DEMO_EMAIL_PATTERN.test(parsed.data.email)) {
    redirect("/login?error=invalid_credentials");
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
