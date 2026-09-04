"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const requestMagicLinkInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

const demoSignInInputSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email()
    .refine((email) => email.endsWith("@nebelspiegel.com")),
  password: z.string().min(1),
  redirectTo: z.string().startsWith("/").optional(),
});

export interface RequestMagicLinkFormState {
  email?: string;
  fieldErrors: Record<string, string>;
  formError?: string;
  sent: boolean;
}

export async function requestMagicLink(
  _prevState: RequestMagicLinkFormState,
  formData: FormData,
): Promise<RequestMagicLinkFormState> {
  const parsed = requestMagicLinkInputSchema.safeParse({
    email: formData.get("email"),
  });
  const redirectToRaw = String(formData.get("redirectTo") ?? "/dashboard");
  const redirectTo =
    redirectToRaw.startsWith("/") && !redirectToRaw.startsWith("//")
      ? redirectToRaw
      : "/dashboard";

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
      emailRedirectTo: `${env.appUrl}/auth/confirm?next=${encodeURIComponent(redirectTo)}`,
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

const isRealProduction =
  process.env["VERCEL_ENV"] === "production" ||
  (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");

const signInInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  redirectTo: z.string().startsWith("/").optional(),
});

/** Plain email+password sign-in — the one, single, simple customer login
 * path (founder direction: no video lander, no passwordless/magic-link
 * primary flow). Same mechanism as admin/retailer's own `signIn` action
 * (packages/auth's Supabase password auth), applied to Customer Portal. */
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

  redirect(parsed.data.redirectTo ?? "/dashboard");
}

export interface SignInFormState {
  formError?: string;
}

/** Same as `signIn`, but for embedding inline (dashboard guest preview,
 * cart, anywhere a mid-task auth prompt must never navigate away) — a
 * wrong password returns a form error instead of redirecting to /login,
 * so the customer never loses their place. Successful sign-in still
 * navigates to `redirectTo`, since that's the real destination, not a
 * click-away. */
export async function signInInline(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const parsed = signInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return { formError: "Enter a valid email and password." };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { formError: "That email and password don't match an account." };
  }

  redirect(parsed.data.redirectTo ?? "/dashboard");
}

/** Seeded showcase accounts use passwords so every persona can be entered
 * deterministically without relying on an email inbox. Normal customer
 * accounts remain passwordless; the domain restriction is deliberate. */
export async function signInToDemo(formData: FormData): Promise<void> {
  if (isRealProduction) {
    redirect("/login?demo=1&error=invalid_demo_credentials");
  }

  const parsed = demoSignInInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    redirect("/login?demo=1&error=invalid_demo_credentials");
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    redirect("/login?demo=1&error=invalid_demo_credentials");
  }

  redirect(parsed.data.redirectTo ?? "/dashboard");
}
