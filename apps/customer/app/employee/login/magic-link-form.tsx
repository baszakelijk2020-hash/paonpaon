"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  requestEmployeeMagicLink,
  type RequestEmployeeMagicLinkFormState,
} from "./actions";

const initialState: RequestEmployeeMagicLinkFormState = {
  fieldErrors: {},
  sent: false,
};

export function EmployeeMagicLinkForm() {
  const [state, formAction, isPending] = useActionState(
    requestEmployeeMagicLink,
    initialState,
  );

  if (state.sent) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-700)]">
        Check <strong>{state.email}</strong> for a sign-in link.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField
        label="Work email"
        htmlFor="email"
        error={state.fieldErrors["email"]}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          invalid={!!state.fieldErrors["email"]}
          required
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending ? "Sending…" : "Send sign-in link"}
      </Button>
    </form>
  );
}
