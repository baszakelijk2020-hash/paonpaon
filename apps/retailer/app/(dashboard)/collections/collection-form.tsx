"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { createCollection, initialCreateCollectionFormState } from "./actions";

export function CollectionForm() {
  const [state, formAction, isPending] = useActionState(
    createCollection,
    initialCreateCollectionFormState,
  );
  const v = state.values;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <FormField label="Name" htmlFor="name" error={state.fieldErrors["name"]}>
        <Input
          id="name"
          name="name"
          defaultValue={v["name"]}
          invalid={!!state.fieldErrors["name"]}
          required
        />
      </FormField>
      <FormField label="Slug" htmlFor="slug" error={state.fieldErrors["slug"]}>
        <Input
          id="slug"
          name="slug"
          defaultValue={v["slug"]}
          invalid={!!state.fieldErrors["slug"]}
          required
        />
      </FormField>
      <FormField label="Season" htmlFor="season" hint="Optional">
        <Input id="season" name="season" defaultValue={v["season"]} />
      </FormField>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add collection"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
