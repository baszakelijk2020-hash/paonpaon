import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { EmployeeMagicLinkForm } from "./magic-link-form";

const ERROR_MESSAGES: Record<string, string> = {
  not_an_employee_account:
    "That account isn't set up for Employee Portal access.",
  invalid_invite: "That sign-in link is invalid or has expired.",
};

/**
 * A distinct front door from the shopper login (`/login`) — deliberately
 * separate per PHASE 18.5's acceptance ("a distinct auth path"), never
 * the same page with a toggle, so an employee and a shopper can never be
 * confused about which one they're using.
 */
export default async function EmployeeLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
        Employee Portal
      </p>
      <h1 className="font-display mt-1 text-3xl text-[var(--color-stone-900)]">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-[var(--color-stone-500)]">
        For employees of a corporate wardrobe programme. Not a shopper account?
        Use the{" "}
        <Link href="/login" className="underline">
          Customer Portal
        </Link>{" "}
        instead.
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
        <EmployeeMagicLinkForm />
      </Card>
    </main>
  );
}
