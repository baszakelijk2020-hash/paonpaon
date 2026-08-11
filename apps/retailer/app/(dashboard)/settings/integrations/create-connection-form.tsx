"use client";

import { INTEGRATION_PROVIDERS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createConnection } from "./actions";

export function CreateConnectionForm() {
  const [state, formAction, isPending] = useActionState(createConnection, {
    success: false,
  });

  if (state.success) {
    return (
      <div
        role="status"
        className="bg-[var(--color-success-500)]/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-success-500)]"
      >
        Connection created successfully. Refresh to see it in the list.
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      <FormField label="Provider" htmlFor="provider">
        <Select
          id="provider"
          name="provider"
          required
          defaultValue=""
          className="w-full"
        >
          <option value="">Select a provider</option>
          {INTEGRATION_PROVIDERS.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Display name" htmlFor="displayName">
        <Input
          id="displayName"
          name="displayName"
          placeholder="e.g., My Shopify Store"
          required
          disabled={isPending}
        />
      </FormField>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create connection"}
        </Button>
      </div>
    </form>
  );
}
