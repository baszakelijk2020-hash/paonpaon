"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { captureFeedback, type StoreFeedbackActionState } from "./actions";

const initial: StoreFeedbackActionState = {};
export function FeedbackCapture({
  customers,
}: {
  readonly customers: readonly { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(captureFeedback, initial);
  return (
    <form
      action={action}
      className="flex flex-col gap-3"
      id="store-feedback-form"
    >
      <FormField
        label="Customer context (optional; consent required)"
        htmlFor="feedback-customer"
      >
        <Select id="feedback-customer" name="customerId" defaultValue="">
          <option value="">No customer context</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="Garment reference (optional)"
        htmlFor="feedback-garment"
      >
        <Input
          id="feedback-garment"
          name="garmentRef"
          placeholder="e.g., navy travel blazer"
        />
      </FormField>
      <FormField label="Leadership audience" htmlFor="feedback-audience">
        <Select id="feedback-audience" name="audience" defaultValue="buying">
          <option value="buying">Buying</option>
          <option value="merchandising">Merchandising</option>
          <option value="client_experience">Client experience</option>
        </Select>
      </FormField>
      <FormField
        label="What did the customer say or do?"
        htmlFor="feedback-text"
      >
        <textarea
          id="feedback-text"
          name="feedback"
          required
          minLength={3}
          className="min-h-24 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] bg-white p-2 text-sm"
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        Route feedback
      </Button>
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
