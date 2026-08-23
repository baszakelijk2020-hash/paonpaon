"use server";

import { DEMO_PASSWORD } from "@paon/database/demo-seed";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const signInInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  redirectTo: z.string().startsWith("/").optional(),
});

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

  // Block only the publicly-known demo password in production — not the
  // seeded accounts' email pattern itself. Blocking by email regardless
  // of password would (and once did, on the retailer app) lock every
  // real seeded account out of production, since those are the only
  // accounts that exist.
  if (isRealProduction && parsed.data.password === DEMO_PASSWORD) {
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
