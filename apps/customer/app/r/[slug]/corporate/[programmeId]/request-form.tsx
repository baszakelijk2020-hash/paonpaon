"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  submitOfficeVisitRequest,
  type SubmitOfficeVisitRequestFormState,
} from "./actions";

const initialState: SubmitOfficeVisitRequestFormState = {
  fieldErrors: {},
  submitted: false,
};

export function OfficeVisitRequestForm({
  programmeId,
}: {
  programmeId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitOfficeVisitRequest.bind(null, programmeId),
    initialState,
  );

  if (state.submitted) {
    return (
      <p role="status" className="text-sm text-[var(--color-stone-700)]">
        Thank you — someone will be in touch shortly.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField
        label="Your name"
        htmlFor="requesterName"
        error={state.fieldErrors["requesterName"]}
      >
        <Input
          id="requesterName"
          name="requesterName"
          required
          invalid={!!state.fieldErrors["requesterName"]}
        />
      </FormField>
      <FormField
        label="Employee reference (optional)"
        htmlFor="employeeReference"
      >
        <Input id="employeeReference" name="employeeReference" />
      </FormField>
      <FormField label="Contact email (optional)" htmlFor="contactEmail">
        <Input id="contactEmail" name="contactEmail" type="email" />
      </FormField>
      <FormField label="Note (optional)" htmlFor="note">
        <textarea
          id="note"
          name="note"
          maxLength={2000}
          className="min-h-20 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 text-sm"
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Sending…" : "Request a visit"}
      </Button>
    </form>
  );
}
