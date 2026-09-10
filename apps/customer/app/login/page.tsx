import { AuthShell } from "@paon/ui/components/AuthShell";
import { Suspense } from "react";

import { EmailFirstForm } from "./email-first-form";
import { QuickDemoLogin } from "./quick-demo-login";

const isRealProduction =
  process.env["VERCEL_ENV"] === "production" ||
  (!process.env["VERCEL_ENV"] && process.env.NODE_ENV === "production");

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Those sign-in details could not be verified.",
  invalid_input: "Enter a valid email address and password.",
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
  }>;
}) {
  const { error, redirectTo } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <AuthShell
      eyebrow="Private client"
      persona="Customer access"
      title="Welcome back."
      description="Your pieces, fittings, conversations and private invitations — kept together, with the people who know you."
      imageUrl="https://www.nebelspiegel.com/images/smaller/6088.webp"
      imageAlt="Tailored wool suit from the PAON collection"
      footer={
        <p>
          Enter your email to sign in or create your private client account.
        </p>
      }
    >
      <EmailFirstForm redirectTo={redirectTo ?? "/dashboard"} />
      {errorMessage ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {errorMessage}
        </p>
      ) : null}
      {!isRealProduction ? (
        <Suspense fallback={null}>
          <QuickDemoLogin redirectTo={redirectTo ?? "/dashboard"} />
        </Suspense>
      ) : null}
    </AuthShell>
  );
}
