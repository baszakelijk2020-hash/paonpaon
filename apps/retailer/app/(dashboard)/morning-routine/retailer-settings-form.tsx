"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  saveMorningRoutineRetailerSettings,
  type MorningRoutineRetailerSettingsFormState,
} from "./actions";

const initial: MorningRoutineRetailerSettingsFormState = { fieldErrors: {} };

export function MorningRoutineRetailerSettingsForm({
  settings,
  products,
}: {
  settings: {
    enabled: boolean;
    deliveryHourLocal: number;
    eligibleProductIds: readonly string[];
  };
  products: readonly { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    saveMorningRoutineRetailerSettings,
    initial,
  );
  const selected = new Set(settings.eligibleProductIds.map(String));

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-[var(--color-stone-900)]">
          MorningRoutine service controls
        </h2>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Restrict catalogue recommendations to eligible products. Customer
          consent and explicit delivery opt-in still apply — this cannot inject
          unrelated promotion.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        {state.success ? (
          <p role="status" className="text-sm text-[var(--color-success-500)]">
            Settings saved.
          </p>
        ) : null}

        <label className="flex items-start gap-2 text-sm text-[var(--color-stone-700)]">
          <input
            type="checkbox"
            name="enabled"
            className="mt-1"
            defaultChecked={settings.enabled}
          />
          <span>Enable MorningRoutine delivery for opted-in customers</span>
        </label>

        <FormField
          label="Default delivery hour (local)"
          htmlFor="deliveryHourLocal"
        >
          <Select
            id="deliveryHourLocal"
            name="deliveryHourLocal"
            defaultValue={String(settings.deliveryHourLocal)}
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}:00
              </option>
            ))}
          </Select>
        </FormField>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-[var(--color-stone-700)]">
            Eligible catalogue products (empty = all active)
          </legend>
          {products.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-500)]">
              No active products yet.
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded border border-[var(--color-stone-200)] p-3">
              {products.map((product) => (
                <label
                  key={product.id}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    name="eligibleProductIds"
                    value={product.id}
                    defaultChecked={selected.has(product.id)}
                  />
                  {product.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save MorningRoutine controls"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
