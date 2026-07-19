"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  addFitProfileEntry,
  initialAddFitProfileEntryFormState,
} from "./actions";

const MEASUREMENT_FIELDS = [
  { name: "chest", label: "Chest" },
  { name: "waist", label: "Waist" },
  { name: "hips", label: "Hips" },
  { name: "inseam", label: "Inseam" },
  { name: "shoulders", label: "Shoulders" },
  { name: "sleeve", label: "Sleeve" },
  { name: "neck", label: "Neck" },
  { name: "height", label: "Height" },
] as const;

export function FitProfileForm({ customerId }: { customerId: string }) {
  const boundAction = addFitProfileEntry.bind(null, customerId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialAddFitProfileEntryFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MEASUREMENT_FIELDS.map((field) => (
          <FormField key={field.name} label={field.label} htmlFor={field.name}>
            <Input id={field.name} name={field.name} placeholder="e.g. 38in" />
          </FormField>
        ))}
      </div>
      <FormField
        label="Fit preferences"
        htmlFor="fitPreferences"
        hint="Optional"
      >
        <Input id="fitPreferences" name="fitPreferences" />
      </FormField>
      <FormField label="Style notes" htmlFor="styleNotes" hint="Optional">
        <Input id="styleNotes" name="styleNotes" />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save fit profile entry"}
        </Button>
      </div>
    </form>
  );
}
