"use client";

import {
  ALTERATION_STATUS_TRANSITIONS,
  canRetailerRoleTransitionAlteration,
  type AlterationStatus,
  type RetailerRole,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  addAlterationUpdate,
  type AddAlterationUpdateFormState,
} from "./actions";

export function UpdateForm({
  alterationId,
  currentStatus,
  role,
}: {
  alterationId: string;
  currentStatus: AlterationStatus;
  role: RetailerRole;
}) {
  const boundAction = addAlterationUpdate.bind(null, alterationId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    {} as AddAlterationUpdateFormState,
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
          {ALTERATION_STATUS_TRANSITIONS[currentStatus]
            .filter(
              (status) =>
                status !== "assigned" &&
                canRetailerRoleTransitionAlteration(
                  role,
                  currentStatus,
                  status,
                ),
            )
            .map((status) => (
              <option key={status} value={status}>
                {status.replaceAll("_", " ")}
              </option>
            ))}
        </Select>
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-[var(--color-stone-700)]">
        <input type="checkbox" name="customerVisible" />
        Customer-visible update
      </label>
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
