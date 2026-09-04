"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { signInInline, type SignInFormState } from "./actions";

const initial: SignInFormState = {};

/**
 * The plain email+password form used inline (dashboard guest preview,
 * cart, any mid-task auth prompt) — never navigates away, even on a
 * wrong password. The standalone /login page uses the same fields but
 * its own server-rendered form (redirect-based, since a full page IS
 * the right place to redirect on error).
 */
export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(signInInline, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <FormField label="Email" htmlFor="inline-email">
        <Input
          id="inline-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </FormField>
      <FormField label="Password" htmlFor="inline-password">
        <Input
          id="inline-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-1">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
