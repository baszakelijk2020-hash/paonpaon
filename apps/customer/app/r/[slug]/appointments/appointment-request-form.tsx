"use client";

import { APPOINTMENT_TYPES, APPOINTMENT_TYPE_LABELS } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
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
  defaultNotes,
}: {
  slug: string;
  retailerId: string;
  isSignedIn: boolean;
  defaultNotes?: string;
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
              {APPOINTMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField
        label="Preferred date & time"
        htmlFor="startsAt"
        error={state.fieldErrors["startsAt"]}
      >
        <DateTimePicker name="startsAt" />
      </FormField>
      <FormField
        label="Anything we should know?"
        htmlFor="notes"
        hint={
          defaultNotes
            ? "Prefilled from your saved style notes — edit as needed"
            : "Optional — style preferences, occasion, sizing questions"
        }
      >
        <Input
          id="notes"
          name="notes"
          defaultValue={state.values["notes"] ?? defaultNotes}
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {/* .paon-appt-confirm: full-width, 52px, uppercase with letter-spacing
          — specific to this one button, not the shared Button default. */}
      <Button
        type="submit"
        disabled={isPending}
        className="mt-2 h-[52px] w-full uppercase tracking-[0.04em]"
      >
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
