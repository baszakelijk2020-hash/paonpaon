"use client";

import {
  CUSTOMER_LIFECYCLE_STAGES,
  CUSTOMER_LIFECYCLE_STAGE_LABELS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createCustomer, type CreateCustomerFormState } from "./actions";

const initialCreateCustomerFormState: CreateCustomerFormState = {
  values: {},
  fieldErrors: {},
};

export function CustomerForm() {
  const [state, formAction, isPending] = useActionState(
    createCustomer,
    initialCreateCustomerFormState,
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Full name"
            htmlFor="fullName"
            error={state.fieldErrors["fullName"]}
          >
            <Input
              id="fullName"
              name="fullName"
              defaultValue={v["fullName"]}
              invalid={!!state.fieldErrors["fullName"]}
              required
            />
          </FormField>
          <FormField
            label="Email"
            htmlFor="email"
            hint="Optional — used to link a future Customer Portal login"
            error={state.fieldErrors["email"]}
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={v["email"]}
              invalid={!!state.fieldErrors["email"]}
            />
          </FormField>
          <FormField
            label="Phone"
            htmlFor="phone"
            error={state.fieldErrors["phone"]}
          >
            <Input id="phone" name="phone" defaultValue={v["phone"]} />
          </FormField>
          <FormField
            label="Lifecycle stage"
            htmlFor="lifecycleStage"
            error={state.fieldErrors["lifecycleStage"]}
          >
            <Select
              id="lifecycleStage"
              name="lifecycleStage"
              defaultValue={v["lifecycleStage"] ?? "prospect"}
            >
              {CUSTOMER_LIFECYCLE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {CUSTOMER_LIFECYCLE_STAGE_LABELS[stage]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Acquisition source"
            htmlFor="acquisitionSource"
            hint="Optional"
            error={state.fieldErrors["acquisitionSource"]}
          >
            <Input
              id="acquisitionSource"
              name="acquisitionSource"
              defaultValue={v["acquisitionSource"]}
            />
          </FormField>
        </div>
      </Card>

      <div className="bg-[var(--color-stone-50)]/95 sticky bottom-20 z-20 -mx-4 mt-6 flex justify-end border-t border-[var(--color-stone-200)] px-4 py-4 backdrop-blur xl:static xl:mx-0 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Add client"}
        </Button>
      </div>
    </form>
  );
}
