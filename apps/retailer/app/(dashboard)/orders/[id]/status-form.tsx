"use client";

import { ORDER_STATUSES, type OrderStatus } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { updateOrderStatus, type UpdateOrderStatusFormState } from "./actions";

const initialUpdateOrderStatusFormState: UpdateOrderStatusFormState = {};

export function StatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const boundAction = updateOrderStatus.bind(null, orderId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialUpdateOrderStatusFormState,
  );

  return (
    <form action={formAction} className="flex items-end gap-3">
      <div>
        <label
          htmlFor="status"
          className="mb-1 block text-sm font-medium text-[var(--color-stone-700)]"
        >
          Status
        </label>
        <Select id="status" name="status" defaultValue={currentStatus}>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Update status"}
      </Button>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
