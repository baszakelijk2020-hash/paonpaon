import { AuthShell } from "@paon/ui/components/AuthShell";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";

import { signIn } from "./actions";
import { QuickDemoLogin } from "./quick-demo-login";

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
    <AuthShell
      eyebrow="Platform administration"
      persona="Platform staff"
      title="Good to see you."
      description="Steward the retailer network, commercial health and PAON service quality from one private operating environment."
      imageUrl="https://www.nebelspiegel.com/images/smaller/6057.webp"
      imageAlt="Tailored overcoat from the PAON collection"
      trustSignals={[
        "Invite-only — no self-serve signup",
        "Full visibility across every retailer tenant",
        "Platform actions are attributed and logged",
      ]}
      footer={
        <p>
          PAON Admin accounts are provisioned by another platform admin — there
          is no self-serve signup.
        </p>
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
          Enter PAON
        </Button>
      </form>
      {process.env.NODE_ENV !== "production" ||
      process.env["NEXT_PUBLIC_DEMO_LOGIN"] === "1" ? (
        <QuickDemoLogin redirectTo={redirectTo} />
      ) : null}
    </AuthShell>
  );
}
