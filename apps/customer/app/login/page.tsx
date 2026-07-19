import { Card } from "@paon/ui/components/Card";

import { MagicLinkForm } from "./magic-link-form";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_invite: "That sign-in link is invalid or has expired.",
  not_a_customer_account: "That account doesn't have Customer Portal access.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo = "/dashboard" } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
          PAON
        </p>
        <h1 className="mb-6 text-2xl font-medium text-[var(--color-stone-900)]">
          Sign in
        </h1>
        <Card>
          {errorMessage ? (
            <p
              role="alert"
              className="mb-4 text-sm text-[var(--color-danger-500)]"
            >
              {errorMessage}
            </p>
          ) : null}
          <MagicLinkForm redirectTo={redirectTo} />
        </Card>
        <p className="mt-4 text-sm text-[var(--color-stone-500)]">
          No password needed — we&rsquo;ll email you a link to sign in.
        </p>
      </div>
    </main>
  );
}
