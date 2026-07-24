import { AuthShell } from "@paon/ui/components/AuthShell";
import Link from "next/link";

import { DemoLoginForm } from "./demo-login-form";
import { MagicLinkForm } from "./magic-link-form";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_invite: "That sign-in link is invalid or has expired.",
  not_a_customer_account: "That account doesn't have Customer Portal access.",
  invalid_demo_credentials: "Those demo credentials could not be verified.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string; error?: string; redirectTo?: string }>;
}) {
  const { demo, error, redirectTo = "/dashboard" } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const isDemo = demo === "1";

  return (
    <AuthShell
      eyebrow="Private client"
      title="Welcome back."
      description="Your pieces, fittings, conversations and private invitations—kept together, with the people who know you."
      imageUrl="https://www.nebelspiegel.com/images/smaller/6061.webp"
      imageAlt="Made-to-measure blazer from the PAON collection"
      footer={
        isDemo ? (
          <p>
            Demo access is restricted to seeded showcase accounts.{" "}
            <Link href="/login" className="underline underline-offset-4">
              Use passwordless sign-in instead.
            </Link>
          </p>
        ) : (
          <p>
            No password needed — we&rsquo;ll email you a private sign-in link.{" "}
            <Link href="/login?demo=1" className="underline underline-offset-4">
              Exploring a seeded demo?
            </Link>
          </p>
        )
      }
    >
      {errorMessage ? (
        <p
          role="alert"
          className="mb-5 border-l-2 border-[var(--color-danger-500)] pl-4 text-sm text-[var(--color-danger-500)]"
        >
          {errorMessage}
        </p>
      ) : null}
      {isDemo ? (
        <DemoLoginForm redirectTo={redirectTo} />
      ) : (
        <MagicLinkForm redirectTo={redirectTo} />
      )}
    </AuthShell>
  );
}
