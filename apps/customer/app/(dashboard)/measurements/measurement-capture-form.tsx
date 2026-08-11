"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  recordGuidedMeasurement,
  type MeasurementCaptureState,
} from "./actions";

const initial: MeasurementCaptureState = {};

interface MeasurementFieldConfig {
  readonly key: string;
  readonly label: string;
}

const MEASUREMENT_FIELDS: readonly MeasurementFieldConfig[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "sleeve_length", label: "Sleeve length" },
  { key: "shoulder", label: "Shoulder" },
  { key: "jacket_length", label: "Jacket length" },
  { key: "trouser_length", label: "Trouser length" },
  { key: "trouser_inseam", label: "Trouser inseam" },
  { key: "hips", label: "Hips" },
];

/**
 * Guided self-measurement capture form. Customer enters 8 measurements in
 * centimetres (one decimal allowed), which are converted to whole millimetres
 * and submitted via a Server Action.
 */
export function MeasurementCaptureForm() {
  const [state, action, pending] = useActionState(
    recordGuidedMeasurement,
    initial,
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Record your measurements
        </h1>
        <p className="mt-2 text-sm text-[var(--color-stone-600)]">
          Enter your measurements in centimetres. One decimal place is allowed
          (e.g., 101.5 cm).
        </p>
      </div>

      {state.success && state.message ? (
        <div className="mb-6 rounded-lg border border-[var(--color-success-200)] bg-[var(--color-success-50)] p-4">
          <p className="text-sm font-medium text-[var(--color-success-900)]">
            {state.message}
          </p>
        </div>
      ) : null}

      <form action={action} className="flex flex-col gap-6">
        <div className="space-y-4 rounded-lg border border-[var(--color-stone-200)] bg-[var(--color-stone-50)] p-6">
          {MEASUREMENT_FIELDS.map((field) => (
            <FormField
              key={field.key}
              htmlFor={field.key}
              label={field.label}
              hint="Enter in centimetres (cm)"
            >
              <Input
                id={field.key}
                name={field.key}
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g., 101.5"
                required
                disabled={pending}
                aria-label={`${field.label} in centimetres`}
              />
            </FormField>
          ))}
        </div>

        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Submitting…" : "Submit measurements"}
        </Button>
      </form>
    </div>
  );
}
