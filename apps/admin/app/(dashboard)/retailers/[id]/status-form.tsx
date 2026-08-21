"use client";

import type { RetailerStatus } from "@paon/domain";
import { useActionState } from "react";

import { setRetailerStatus, type RetailerStatusActionState } from "./actions";

const initial: RetailerStatusActionState = {};

export function RetailerStatusForm({
  retailerId,
  status,
}: {
  retailerId: string;
  status: RetailerStatus;
}) {
  const [state, action, pending] = useActionState(setRetailerStatus, initial);

  return (
    <form action={action} className="mt-4 flex flex-wrap gap-2">
      <input type="hidden" name="retailerId" value={retailerId} />
      {status === "active" ? (
        <button
          type="submit"
          name="status"
          value="suspended"
          disabled={pending}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-xs disabled:opacity-50"
        >
          {pending ? "Updating…" : "Suspend retailer"}
        </button>
      ) : (
        <button
          type="submit"
          name="status"
          value="active"
          disabled={pending}
          className="h-9 rounded-[var(--radius-md)] bg-[var(--color-stone-900)] px-3 text-xs text-white disabled:opacity-50"
        >
          {pending ? "Updating…" : "Activate retailer"}
        </button>
      )}
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-[var(--color-success-500)]">
          Status updated.
        </p>
      ) : null}
    </form>
  );
}
