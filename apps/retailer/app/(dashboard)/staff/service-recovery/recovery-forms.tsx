"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  decideBudget,
  requestBudget,
  type RecoveryActionState,
} from "./actions";

const initial: RecoveryActionState = {};

export interface CustomerOption {
  readonly id: string;
  readonly fullName: string;
}

export interface OrderOption {
  readonly id: string;
  readonly orderNumber: string;
}

export function RequestBudgetForm({
  customers,
  orders,
}: {
  readonly customers: readonly CustomerOption[];
  readonly orders: readonly OrderOption[];
}) {
  const [state, action, pending] = useActionState(requestBudget, initial);

  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <FormField htmlFor="amount" label="Amount (€)">
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          max="250"
          required
          disabled={pending}
        />
      </FormField>

      <FormField htmlFor="reason" label="What happened">
        <textarea
          id="reason"
          name="reason"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          placeholder="A few words on what this is for."
          disabled={pending}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>

      <FormField
        htmlFor="customerId"
        label="Client (optional if attached to an order)"
      >
        <Select id="customerId" name="customerId" disabled={pending}>
          <option value="">None</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        htmlFor="orderId"
        label="Order (optional if attached to a client)"
      >
        <Select id="orderId" name="orderId" disabled={pending}>
          <option value="">None</option>
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              {o.orderNumber}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Requesting…" : "Request budget"}
        </Button>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

export function DecideBudgetForm({
  requestId,
}: {
  readonly requestId: string;
}) {
  const [state, action, pending] = useActionState(decideBudget, initial);

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="requestId" value={requestId} />
      <textarea
        name="decisionNote"
        placeholder="Note (optional)"
        rows={2}
        disabled={pending}
        className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="approve"
          size="sm"
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="decision"
          value="decline"
          variant="outline"
          size="sm"
          disabled={pending}
        >
          Decline
        </Button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-xs text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
