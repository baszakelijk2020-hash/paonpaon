import { AuthShell } from "@paon/ui/components/AuthShell";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Suspense } from "react";

import { signIn } from "./actions";
import { QuickDemoLogin } from "./quick-demo-login";

const DEMO_PASSWORD = "Demo-PAON-2026!";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials:
    "That email and password don't match a Retailer Portal account.",
  invalid_input: "Enter a valid email and password.",
  not_retailer_staff: "That account doesn't have Retailer Portal access.",
  invalid_invite: "That invite link is invalid or has expired.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    redirectTo?: string;
    demo?: string;
    email?: string;
  }>;
}) {
  const { error, redirectTo, demo, email } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const prefilledEmail =
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
  const isDemo = demo === "1";

  return (
    <AuthShell
      eyebrow="Retail operations"
      persona="Staff access"
      title="Open the atelier."
      description="A calm command centre for client relationships, fittings, garments and every promise your team is carrying today."
      imageUrl="https://www.nebelspiegel.com/images/smaller/6054.webp"
      imageAlt="Tailored wool suit from the PAON collection"
      footer={
        <p>
          Retailer Portal accounts are provisioned by your retailer&rsquo;s
          owner or by PAON Admin — there is no self-serve signup.
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
            defaultValue={isDemo && prefilledEmail ? DEMO_PASSWORD : ""}
            required
          />
        </FormField>
        {errorMessage ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {errorMessage}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-2 w-full">
          Enter the atelier
        </Button>
      </form>
      {process.env.NODE_ENV !== "production" ||
      process.env["NEXT_PUBLIC_DEMO_LOGIN"] === "1" ? (
        <Suspense fallback={null}>
          <QuickDemoLogin redirectTo={redirectTo} />
        </Suspense>
      ) : null}
    </AuthShell>
  );
}
