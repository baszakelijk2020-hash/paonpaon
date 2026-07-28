"use client";

import { APPOINTMENT_TYPES } from "@paon/domain";
import type { Customer, RetailerStaffMember } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { DateTimePicker } from "@paon/ui/components/DateTimePicker";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createAppointment, type CreateAppointmentFormState } from "./actions";

const initialCreateAppointmentFormState: CreateAppointmentFormState = {
  values: {},
  fieldErrors: {},
};

export function AppointmentForm({
  customers,
  staff,
}: {
  customers: readonly Customer[];
  staff: readonly RetailerStaffMember[];
}) {
  const [state, formAction, isPending] = useActionState(
    createAppointment,
    initialCreateAppointmentFormState,
  );
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-sm)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}

      <Card className="paon-reveal flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Customer"
            htmlFor="customerId"
            error={state.fieldErrors["customerId"]}
          >
            <Select
              id="customerId"
              name="customerId"
              defaultValue={v["customerId"]}
              required
            >
              <option value="" disabled>
                Select a customer
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Type"
            htmlFor="type"
            error={state.fieldErrors["type"]}
          >
            <Select
              id="type"
              name="type"
              defaultValue={v["type"] ?? APPOINTMENT_TYPES[0]}
            >
              {APPOINTMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Starts"
            htmlFor="startsAt"
            hint="Store local time"
            error={state.fieldErrors["startsAt"]}
          >
            <DateTimePicker name="startsAt" defaultValue={v["startsAt"]} />
          </FormField>
          <FormField
            label="Ends"
            htmlFor="endsAt"
            error={state.fieldErrors["endsAt"]}
          >
            <DateTimePicker name="endsAt" defaultValue={v["endsAt"]} />
          </FormField>
          <FormField
            label="Advisor"
            htmlFor="staffId"
            hint="Optional — can be assigned later"
          >
            <Select
              id="staffId"
              name="staffId"
              defaultValue={v["staffId"] ?? ""}
            >
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Notes" htmlFor="notes" hint="Optional">
            <Input id="notes" name="notes" defaultValue={v["notes"]} />
          </FormField>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Booking…" : "Book appointment"}
        </Button>
      </div>
    </form>
  );
}
