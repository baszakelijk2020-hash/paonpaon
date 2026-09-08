"use server";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { type AppSession, resolveAppSession } from "@paon/auth";
import { CustomerRepository } from "@paon/database";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { env } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
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

const emailOtpInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  redirectTo: internalPath.optional(),
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

export interface EmailOtpFormState {
  email?: string;
  fieldErrors: Record<string, string>;
  formError?: string;
  next?: "password" | "register" | "verify-email";
}

export interface VerifyEmailOtpFormState {
  formError?: string;
  verified: boolean;
}

export interface ResendEmailOtpFormState {
  formError?: string;
  sent: boolean;
}

export interface PasswordEnrollmentFormState {
  formError?: string;
}

export interface EmailLinkFormState {
  formError?: string;
  sent: boolean;
}

export interface RegistrationFormState {
  email?: string;
  fieldErrors: Record<string, string>;
  formError?: string;
  sent: boolean;
}

export interface RecoveryPasswordFormState {
  formError?: string;
}

function appOrigin(): string {
  // This comes exclusively from the server-only deployment configuration.
  // FormData must never decide where an authentication email sends someone.
  return new URL(env.appUrl).origin;
}

function confirmationUrl(next: string): string {
  return `${appOrigin()}/auth/confirm?next=${encodeURIComponent(next)}`;
}

const recognitionResultSchema = z.object({
  allowed: z.boolean(),
  existing: z.boolean().optional(),
});

type RecognitionAdminClient = {
  rpc(
    functionName: "recognize_customer_login_email",
    args: {
      p_normalized_email: string;
      p_email_hash: string;
      p_ip_hash: string;
      p_pair_hash: string;
    },
  ): Promise<{ data: unknown; error: { message: string } | null }>;
};

function hashRecognitionValue(value: string): string {
  // This is a server-only secret already required by the customer app. The
  // hashes are solely rate-limit keys and are never returned to the browser.
  return createHmac("sha256", env.supabaseServiceRoleKey)
    .update(value)
    .digest("hex");
}

async function sourceClientIp(): Promise<string> {
  const requestHeaders = await headers();
  const candidates = [
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
    requestHeaders.get("x-real-ip")?.trim(),
    requestHeaders.get("cf-connecting-ip")?.trim(),
  ];
  return (
    candidates.find((candidate) => candidate && isIP(candidate)) ?? "unknown"
  );
}

export async function requestEmailOtp(
  _prevState: EmailOtpFormState,
  formData: FormData,
): Promise<EmailOtpFormState> {
  const parsed = emailOtpInputSchema.safeParse({
    email: formData.get("email"),
    redirectTo: formData.get("redirectTo") || undefined,
  });

  if (!parsed.success) {
    return {
      fieldErrors: { email: "Enter a valid email address." },
    };
  }

  const ip = await sourceClientIp();
  const emailHash = hashRecognitionValue(parsed.data.email);
  const ipHash = hashRecognitionValue(ip);
  const pairHash = hashRecognitionValue(`${ip}\u0000${parsed.data.email}`);
  // The forward migration introduces this internal RPC. Keep its narrow
  // response contract here until generated database types are refreshed by
  // the migration pipeline.
  const admin = getSupabaseAdminClient() as unknown as RecognitionAdminClient;
  const { data, error: recognitionError } = await admin.rpc(
    "recognize_customer_login_email",
    {
      p_normalized_email: parsed.data.email,
      p_email_hash: emailHash,
      p_ip_hash: ipHash,
      p_pair_hash: pairHash,
    },
  );
  const recognition = recognitionResultSchema.safeParse(data);
  if (recognitionError || !recognition.success || !recognition.data.allowed) {
    return {
      email: parsed.data.email,
      fieldErrors: {},
      formError: "We could not continue right now. Please try again shortly.",
    };
  }

  if (recognition.data.existing) {
    return {
      email: parsed.data.email,
      fieldErrors: {},
      next: "password",
    };
  }

  return {
    email: parsed.data.email,
    fieldErrors: {},
    next: "register",
  };
}

/** Sends a passwordless sign-in email only for the already-recognized path.
 * `shouldCreateUser: false` is non-negotiable: this action must never turn a
 * typo or stale client state into a new account. */
export async function requestExistingEmailMagicLink(
  _prevState: EmailLinkFormState,
  formData: FormData,
): Promise<EmailLinkFormState> {
  const parsed = emailOtpInputSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { formError: "Enter a valid email address.", sent: false };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: confirmationUrl("/dashboard"),
    },
  });
  return error
    ? {
        formError: "We could not send that sign-in email. Please try again.",
        sent: false,
      }
    : { sent: true };
}

/** Password recovery intentionally has the same success response whether an
 * address exists or not. This avoids turning the reset endpoint into an
 * account-enumeration oracle. */
export async function requestPasswordReset(
  _prevState: EmailLinkFormState,
  formData: FormData,
): Promise<EmailLinkFormState> {
  const parsed = emailOtpInputSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { formError: "Enter a valid email address.", sent: false };
  }

  const supabase = await getSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmationUrl("/account/update-password"),
  });
  return { sent: true };
}

const registrationInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  // E.164 only. The UI may format a number while it is being typed, but this
  // server boundary persists a normalized value, never a locale guess.
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{6,14}$/),
  newsletterOptIn: z.boolean(),
});

/** Creates an unknown visitor's Auth account. Profile and newsletter rows are
 * deliberately not created here: without a retailer relationship there is no
 * tenant-safe destination for them. Metadata is display-only, never authz. */
export async function registerEmailPassword(
  _prevState: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const parsed = registrationInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    newsletterOptIn:
      formData.get("newsletterOptIn") === "true" ||
      formData.get("newsletterOptIn") === "on",
  });
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    const submittedEmail = formData.get("email");
    return {
      ...(typeof submittedEmail === "string" ? { email: submittedEmail } : {}),
      fieldErrors: {
        ...(fields.email ? { email: "Enter a valid email address." } : {}),
        ...(fields.password
          ? { password: "Use a password with at least 12 characters." }
          : {}),
        ...(fields.firstName ? { firstName: "Enter your first name." } : {}),
        ...(fields.lastName ? { lastName: "Enter your last name." } : {}),
        ...(fields.phone ? { phone: "Enter a valid phone number." } : {}),
      },
      sent: false,
    };
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: confirmationUrl("/dashboard"),
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        phone: parsed.data.phone,
        newsletter_opt_in: parsed.data.newsletterOptIn,
      },
    },
  });
  if (error) {
    return {
      email: parsed.data.email,
      fieldErrors: {},
      formError: "We could not create your account. Please try again.",
      sent: false,
    };
  }
  return { email: parsed.data.email, fieldErrors: {}, sent: true };
}

export async function resendEmailOtp(
  _prevState: ResendEmailOtpFormState,
  formData: FormData,
): Promise<ResendEmailOtpFormState> {
  const parsed = emailOtpInputSchema.safeParse({
    email: formData.get("email"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return {
      formError: "We could not send a confirmation code. Please start again.",
      sent: false,
    };
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });
  return error
    ? {
        formError:
          "We could not send a confirmation code. Please try again shortly.",
        sent: false,
      }
    : { sent: true };
}

const verifyEmailOtpInputSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  redirectTo: internalPath.optional(),
});

const enrollPasswordInputSchema = z
  .object({
    password: z.string().min(12),
    passwordConfirmation: z.string().min(12),
    redirectTo: internalPath.optional(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
  });

export async function verifyEmailOtp(
  _prevState: VerifyEmailOtpFormState,
  formData: FormData,
): Promise<VerifyEmailOtpFormState> {
  const parsed = verifyEmailOtpInputSchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return {
      formError:
        "That code could not be verified. Request a new code and try again.",
      verified: false,
    };
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });
  if (error) {
    return {
      formError:
        "That code could not be verified. Request a new code and try again.",
      verified: false,
    };
  }
  await new CustomerRepository(supabase).linkMyAccounts();
  return { verified: true };
}

export async function enrollPassword(
  _prevState: PasswordEnrollmentFormState,
  formData: FormData,
): Promise<PasswordEnrollmentFormState> {
  const parsed = enrollPasswordInputSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return { formError: "Use matching passwords with at least 12 characters." };
  }
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { formError: "Your confirmation has expired. Please start again." };
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { formError: "We could not set that password. Please try again." };
  }
  await new CustomerRepository(supabase).linkMyAccounts();
  redirect(parsed.data.redirectTo ?? "/dashboard");
}

/** Completes a recovery-link session. The recovery confirmation route has
 * already verified the one-time token; still require its resulting user here
 * so a direct visit to the public page cannot change a password. */
export async function updateRecoveredPassword(
  _prevState: RecoveryPasswordFormState,
  formData: FormData,
): Promise<RecoveryPasswordFormState> {
  const parsed = enrollPasswordInputSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) {
    return { formError: "Use matching passwords with at least 12 characters." };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      formError: "Your password-reset link has expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      formError: "We could not update that password. Please try again.",
    };
  }
  redirect("/dashboard");
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
 * The portal that owns this account, when it is not one this app serves.
 *
 * Platform and retailer-staff accounts belong to the admin and retailer apps,
 * which are separate Next apps on their own origins. Returning null means the
 * account either belongs here or has nowhere configured to go.
 */
function siblingPortalFor(session: AppSession | null): string | null {
  if (session?.accountType === "platform") return env.adminAppUrl ?? null;
  if (session?.accountType === "retailer_staff")
    return env.retailerAppUrl ?? null;
  return null;
}

/**
 * Whether a sibling portal is on this app's own host, and so can already see
 * the session cookie the browser just stored. Ports are excluded deliberately:
 * cookies ignore them, which is why the three apps share a session on
 * localhost. An unparseable or unset URL is treated as a different host, the
 * conservative answer.
 */
function sharesHostWith(portalUrl: string): boolean {
  try {
    return new URL(portalUrl).hostname === new URL(env.appUrl).hostname;
  } catch {
    return false;
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

  await new CustomerRepository(supabase).linkMyAccounts();

  const session = resolveAppSession(data.user);
  const destination = destinationFor(session);

  // Checked BEFORE honouring redirectTo, so a `redirectTo` cannot smuggle a
  // platform or retailer-staff account onto a customer path. Middleware's
  // /manager and /employee branches deliberately leave a wrong-type session
  // alone (they protect customers who wandered onto the wrong sub-path), so
  // with the two steps in the other order those paths were reachable.
  if (!destination) {
    const portal = siblingPortalFor(session);
    if (portal) {
      /*
       * Their portal is a separate app, so send them to it.
       *
       * Whether the session travels depends on the cookie, which the browser
       * scopes to the host and not the origin. Same host (the three apps on
       * localhost, where the port is ignored) means it is already there and
       * they arrive signed in — the point of a single sign-in. A different
       * host means it cannot follow them, so keeping it here buys nothing and
       * would leave an authenticated session on an origin whose every route
       * rejects it; it is cleared, and the sibling app asks them to sign in
       * exactly as it would have anyway.
       *
       * No token is placed in the URL in either case.
       */
      if (!sharesHostWith(portal)) {
        await supabase.auth.signOut();
      }
      redirect(portal);
    }
    // No URL configured for that portal: sign out rather than leave a session
    // on an origin where every route would reject it.
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
    return { formError: "Those sign-in details could not be verified." };
  }

  await new CustomerRepository(supabase).linkMyAccounts();

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
