import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";

import { signIn } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials:
    "That email and password don't match a PAON Admin account.",
  invalid_input: "Enter a valid email and password.",
  not_platform_staff: "That account doesn't have PAON Admin access.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
          PAON Admin
        </p>
        <h1 className="mb-6 text-2xl font-medium text-[var(--color-stone-900)]">
          Sign in
        </h1>
        <Card>
          <form action={signIn} className="flex flex-col gap-4">
            {redirectTo ? (
              <input type="hidden" name="redirectTo" value={redirectTo} />
            ) : null}
            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
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
              <p
                role="alert"
                className="text-sm text-[var(--color-danger-500)]"
              >
                {errorMessage}
              </p>
            ) : null}
            <Button type="submit" className="mt-2">
              Sign in
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-sm text-[var(--color-stone-500)]">
          PAON Admin accounts are provisioned by another platform admin — there
          is no self-serve signup.
        </p>
      </div>
    </main>
  );
}
