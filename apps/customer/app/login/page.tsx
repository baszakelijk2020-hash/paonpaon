import { AuthShell } from "@paon/ui/components/AuthShell";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Suspense } from "react";

import { signIn } from "./actions";
import { QuickDemoLogin } from "./quick-demo-login";

const isRealProduction =
  process.env["VERCEL_ENV"] === "production" ||
  (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password don't match an account.",
  invalid_input: "Enter a valid email and password.",
  not_a_customer_account: "That account doesn't have Customer Portal access.",
  invalid_invite: "That sign-in link is invalid or has expired.",
  use_admin_portal:
    "That's a platform account. Sign in at the admin app instead.",
  use_retailer_portal:
    "That's a retailer account. Sign in at the retailer app instead.",
};

/**
 * One plain email+password screen — same pattern as admin/retailer's own
 * `/login`, deliberately. Previously a distinct full-bleed video-hero
 * lander with separate magic-link/demo-password toggle screens
 * (ADR-046/047); the founder reversed that direction — no production
 * value, no passwordless-by-default, one simple form everywhere.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    redirectTo?: string;
    email?: string;
  }>;
}) {
  const { error, redirectTo, email } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const prefilledEmail =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;

  return (
    <AuthShell
      eyebrow="Private client"
      persona="Customer access"
      title="Welcome back."
      description="Your pieces, fittings, conversations and private invitations — kept together, with the people who know you."
      imageUrl="https://www.nebelspiegel.com/images/smaller/6088.webp"
      imageAlt="Tailored wool suit from the PAON collection"
      footer={
        <p>No self-serve signup yet — your retailer sets up your account.</p>
      }
    >
      <form action={signIn} className="flex flex-col gap-5">
        {redirectTo ? (
          <input type="hidden" name="redirectTo" value={redirectTo} />
        ) : null}
        <FormField label="Email" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={prefilledEmail ?? ""}
            required
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </FormField>
        {errorMessage ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-2 w-full">
          Sign in
        </Button>
      </form>
      {!isRealProduction ? (
        <Suspense fallback={null}>
          <QuickDemoLogin redirectTo={redirectTo ?? "/dashboard"} />
        </Suspense>
      ) : null}
    </AuthShell>
  );
}
