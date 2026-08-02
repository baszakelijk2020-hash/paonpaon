"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import { createGroupFitting, type CreateGroupFittingState } from "../actions";

const initial: CreateGroupFittingState = {};

export function GroupFittingForm({
  weddingPartyId,
}: {
  weddingPartyId: string;
}) {
  const boundAction = createGroupFitting.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Date and time" htmlFor="scheduledAt">
          <Input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            required
          />
        </FormField>
        <FormField label="Capacity" htmlFor="capacity">
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={6}
            required
          />
        </FormField>
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="self-start"
      >
        {isPending ? "Scheduling…" : "Schedule group fitting"}
      </Button>
    </form>
  );
}
