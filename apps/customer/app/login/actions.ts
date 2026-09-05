"use server";

import { type AppSession, resolveAppSession } from "@paon/auth";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * An in-app destination, and only that.
 *
 * `.startsWith("/")` alone is not enough: `//evil.com` passes it, and a
 * `Location: //evil.com` is scheme-relative, so the browser navigates
 * off-site — immediately after a successful sign-in, the moment the visitor
 * trusts the page most. A leading backslash (`/\evil.com`) normalises to the
 * same thing during URL parsing. `requestMagicLink` in this file already
 * guarded against the first form; this covers both, for every action that
 * takes a `redirectTo`.
 */
const internalPath = z
  .string()
  .startsWith("/")
  .refine((value) => !/^\/[/\\]/.test(value), {
    message: "redirectTo must be a path on this site",
  });

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
  redirectTo: internalPath.optional(),
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
  redirectTo: internalPath.optional(),
});

/**
 * Where a freshly authenticated account belongs, by what it actually is.
 *
 * The three portals this app serves (`/login`, `/manager/login`,
 * `/employee/login`) used to be separate front doors, each asking the person
 * to know in advance which one applied to them. The account already carries
 * that answer in its JWT claims, so one form can read it and send them to the
 * right place — which is the point of a single sign-in.
 *
 * `platform` and `retailer_staff` accounts are NOT routed here: those portals
 * are separate Next apps on their own origins, and a Supabase session cookie
 * set on this origin is not readable there. They are told where to go instead
 * of being dropped somewhere they'd appear signed out.
 */
function destinationFor(session: AppSession | null): string | null {
  switch (session?.accountType) {
    case "customer":
      return "/dashboard";
    case "corporate_manager":
      return "/manager";
    case "corporate_wearer":
      return "/employee";
    default:
      return null;
  }
}

/**
 * The single sign-in for this app: one email+password form for shoppers,
 * corporate managers and corporate wearers alike, routed by account type.
 *
 * Replaces the previous arrangement of three separate login pages
 * (ADR/PHASE 14.1 and 18.5 deliberately kept them apart so the three
 * audiences could not confuse them). Founder direction reversed that: one
 * platform, one front door. `/manager/login` and `/employee/login` now
 * redirect here rather than 404, so existing links and invite emails keep
 * working.
 */
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    redirect("/login?error=invalid_credentials");
  }

  const session = resolveAppSession(data.user);
  const destination = destinationFor(session);

  // Checked BEFORE honouring redirectTo. A platform or retailer-staff account
  // is a valid login whose portal is another origin, and leaving its session
  // on this origin is what the sign-out exists to prevent — so a `redirectTo`
  // must not be able to skip it. Middleware's /manager and /employee branches
  // deliberately do not sign out a wrong-type session (they protect customers
  // who wandered onto the wrong sub-path), so with the two steps in the other
  // order those two paths left the cookie behind indefinitely.
  if (!destination) {
    await supabase.auth.signOut();
    redirect(
      session?.accountType === "platform"
        ? "/login?error=use_admin_portal"
        : "/login?error=use_retailer_portal",
    );
  }

  // An explicit redirectTo is the caller's intent — a deep link the visitor was
  // interrupted on. Middleware still enforces access on arrival, so it cannot
  // reach a portal this account has no claim for.
  redirect(parsed.data.redirectTo ?? destination);
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
