"use client";

import { APPOINTMENT_TYPES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  requestAppointment,
  type RequestAppointmentFormState,
} from "./actions";

const initialRequestAppointmentFormState: RequestAppointmentFormState = {
  values: {},
  fieldErrors: {},
};

export function AppointmentRequestForm({
  slug,
  retailerId,
  isSignedIn,
}: {
  slug: string;
  retailerId: string;
  isSignedIn: boolean;
}) {
  const boundAction = requestAppointment.bind(null, slug, retailerId);
  const [state, formAction, isPending] = useActionState(
    boundAction,
    initialRequestAppointmentFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField
        label="What would you like to book?"
        htmlFor="type"
        error={state.fieldErrors["type"]}
      >
        <Select id="type" name="type" defaultValue={APPOINTMENT_TYPES[0]}>
          {APPOINTMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="Preferred date & time"
        htmlFor="startsAt"
        error={state.fieldErrors["startsAt"]}
      >
        <Input
          id="startsAt"
          name="startsAt"
          type="datetime-local"
          invalid={!!state.fieldErrors["startsAt"]}
          required
        />
      </FormField>
      <FormField
        label="Anything we should know?"
        htmlFor="notes"
        hint="Optional — style preferences, occasion, sizing questions"
      >
        <Input id="notes" name="notes" />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-2">
        {isPending
          ? "Requesting…"
          : isSignedIn
            ? "Request appointment"
            : "Sign in & request appointment"}
      </Button>
      <p className="text-xs text-[var(--color-stone-500)]">
        This is a request, not a confirmed booking — we&rsquo;ll follow up to
        confirm the time.
      </p>
    </form>
  );
}
