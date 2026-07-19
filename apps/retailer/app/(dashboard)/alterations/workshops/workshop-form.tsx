"use client";

import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { createWorkshop, type WorkshopFormState } from "./actions";

export function WorkshopForm() {
  const [state, action, pending] = useActionState(
    createWorkshop,
    {} as WorkshopFormState,
  );

  return (
    <form action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <Input
        name="name"
        aria-label="Workshop name"
        placeholder="Workshop name"
        required
      />
      <Input
        name="email"
        aria-label="Workshop email"
        type="email"
        placeholder="Email (optional)"
      />
      <Input
        name="phone"
        aria-label="Workshop phone"
        placeholder="Phone (optional)"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add workshop"}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="text-sm text-[var(--color-danger-500)] sm:col-span-4"
        >
          {state.formError}
        </p>
      ) : null}
      {state.success ? (
        <p
          role="status"
          className="text-sm text-[var(--color-success-500)] sm:col-span-4"
        >
          Workshop added.
        </p>
      ) : null}
    </form>
  );
}
