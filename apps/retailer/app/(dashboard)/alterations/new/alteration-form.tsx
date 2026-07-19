"use client";

import type { Customer } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createAlteration, initialCreateAlterationFormState } from "./actions";

export function AlterationForm({
  customers,
  defaultCustomerId,
}: {
  customers: readonly Customer[];
  defaultCustomerId?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAlteration,
    initialCreateAlterationFormState,
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-sm)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      <Card className="flex flex-col gap-4">
        <FormField
          label="Customer"
          htmlFor="customerId"
          error={state.fieldErrors["customerId"]}
        >
          <Select
            id="customerId"
            name="customerId"
            defaultValue={v["customerId"] ?? defaultCustomerId}
            required
          >
            <option value="" disabled>
              Select a customer
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Instructions"
          htmlFor="instructions"
          error={state.fieldErrors["instructions"]}
        >
          <Input
            id="instructions"
            name="instructions"
            defaultValue={v["instructions"]}
            invalid={!!state.fieldErrors["instructions"]}
            required
          />
        </FormField>
        <FormField
          label="Due date"
          htmlFor="dueDate"
          hint="Optional"
          error={state.fieldErrors["dueDate"]}
        >
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={v["dueDate"]}
          />
        </FormField>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create alteration"}
        </Button>
      </div>
    </form>
  );
}
