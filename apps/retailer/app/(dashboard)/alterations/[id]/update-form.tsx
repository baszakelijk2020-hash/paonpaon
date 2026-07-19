"use client";

import { ALTERATION_STATUSES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  addAlterationUpdate,
  initialAddAlterationUpdateFormState,
} from "./actions";

export function UpdateForm({
  alterationId,
  currentStatus,
}: {
  alterationId: string;
  currentStatus: string;
}) {
  const boundAction = addAlterationUpdate.bind(null, alterationId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialAddAlterationUpdateFormState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
        >
          Status
        </label>
        <Select id="status" name="status" defaultValue={currentStatus}>
          {ALTERATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <div className="min-w-[16rem] flex-1">
        <label
          htmlFor="note"
          className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
        >
          Note
        </label>
        <Input id="note" name="note" placeholder="Optional" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add update"}
      </Button>
      {state.formError ? (
        <p
          role="alert"
          className="w-full text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
