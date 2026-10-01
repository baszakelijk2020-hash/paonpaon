"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { createClosure, type ClosureFormState } from "./actions";

const EMPTY: ClosureFormState = { values: {} };

export function ClosureForm({
  branches,
}: {
  readonly branches: readonly { id: string; name: string }[];
}) {
  const [state, action] = useActionState(createClosure, EMPTY);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-stone-600)]">Branch</span>
          <select
            name="branchId"
            defaultValue=""
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          >
            {/* The default is deliberately the widest one: a public holiday
                closes the business, not one shop. */}
            <option value="">Every branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-stone-600)]">
            Reason (optional)
          </span>
          <input
            type="text"
            name="reason"
            maxLength={240}
            placeholder="Public holiday, stocktake, private fitting…"
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-stone-600)]">Closed from</span>
          <input
            type="datetime-local"
            name="startsAt"
            required
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--color-stone-600)]">Closed until</span>
          <input
            type="datetime-local"
            name="endsAt"
            required
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2"
          />
        </label>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}

      <div>
        <Button type="submit">Add closure</Button>
      </div>
    </form>
  );
}
