import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { ManagerMagicLinkForm } from "./magic-link-form";

const ERROR_MESSAGES: Record<string, string> = {
  not_a_manager_account: "That account isn't set up for Manager Portal access.",
  invalid_invite: "That sign-in link is invalid or has expired.",
};

/**
 * A distinct front door from the shopper login (`/login`) and the
 * Employee Portal (`/employee/login`) — deliberately separate per PHASE
 * 14.1's acceptance, never the same page with a toggle, so a manager, an
 * employee, and a shopper can never be confused about which one they're
 * using.
 */
export default async function ManagerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        Manager Portal
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-[var(--color-stone-500)]">
        For programme administrators at a corporate account. For individual
        wearers, use the{" "}
        <Link href="/employee/login" className="underline">
          Employee Portal
        </Link>{" "}
        instead. For customers, visit the{" "}
        <Link href="/login" className="underline">
          Customer Portal
        </Link>
        .
      </p>

      <Card className="mt-6">
        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 text-sm text-[var(--color-danger-500)]"
          >
            {errorMessage}
          </p>
        ) : null}
        <ManagerMagicLinkForm />
      </Card>
    </main>
  );
}
