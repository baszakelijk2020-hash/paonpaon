"use client";

import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { useActionState, useState } from "react";

import {
  markPaidInStore,
  requestReturn,
  type OrderActionState,
} from "./actions";

const initialOrderActionState: OrderActionState = {};

export function MarkPaidInStoreForm({ orderId }: { orderId: string }) {
  const boundAction = markPaidInStore.bind(null, orderId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialOrderActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Recording…" : "Mark paid in store"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}

export function RequestReturnForm({ orderId }: { orderId: string }) {
  const boundAction = requestReturn.bind(null, orderId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialOrderActionState,
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Request return
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm font-medium text-[var(--color-stone-900)]">
        Request a return
      </p>
      <form action={formAction} className="flex flex-col gap-3">
        <textarea
          name="reason"
          required
          maxLength={2000}
          placeholder="Reason for the return…"
          className="min-h-24 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Recording…" : "Confirm return"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
