"use client";

import type { RetailerStatus } from "@paon/domain";
import { ConfirmSubmitButton } from "@paon/ui/components/ConfirmSubmitButton";
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
        <ConfirmSubmitButton
          variant="destructive"
          confirmMessage="Suspend this retailer's account immediately? Their staff will lose access."
          disabled={pending}
        >
          {pending ? "Updating…" : "Suspend retailer"}
        </ConfirmSubmitButton>
      ) : (
        <ConfirmSubmitButton
          variant="primary"
          confirmMessage="Activate this retailer's account?"
          disabled={pending}
        >
          {pending ? "Updating…" : "Activate retailer"}
        </ConfirmSubmitButton>
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
