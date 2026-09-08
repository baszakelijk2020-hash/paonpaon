"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  updateRecoveredPassword,
  type RecoveryPasswordFormState,
} from "../../login/actions";

const initialState: RecoveryPasswordFormState = {};

export function UpdatePasswordForm() {
  const [state, formAction, isPending] = useActionState(
    updateRecoveredPassword,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormField label="New password" htmlFor="new-password">
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className="rounded-full"
        />
      </FormField>
      <FormField label="Confirm new password" htmlFor="confirm-password">
        <Input
          id="confirm-password"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={12}
          required
          className="rounded-full"
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-2 w-full rounded-full"
      >
        {isPending ? "Updating password…" : "Update password"}
      </Button>
    </form>
  );
}
