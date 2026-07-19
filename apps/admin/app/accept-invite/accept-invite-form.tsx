"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { acceptInvite, type AcceptInviteFormState } from "./actions";

const initialState: AcceptInviteFormState = { fieldErrors: {} };

export function AcceptInviteForm({ staffId }: { staffId: string }) {
  const [state, action, pending] = useActionState(acceptInvite, initialState);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="staffId" value={staffId} />
      <FormField
        label="Password"
        htmlFor="password"
        hint="At least 8 characters"
        error={state.fieldErrors["password"]}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          invalid={!!state.fieldErrors["password"]}
          required
        />
      </FormField>
      <FormField
        label="Confirm password"
        htmlFor="confirmPassword"
        error={state.fieldErrors["confirmPassword"]}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          invalid={!!state.fieldErrors["confirmPassword"]}
          required
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Setting password…" : "Set password & continue"}
      </Button>
    </form>
  );
}
