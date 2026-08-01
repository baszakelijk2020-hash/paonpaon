"use client";

import { APPOINTMENT_TYPES, APPOINTMENT_TYPE_LABELS } from "@paon/domain";
import type {
  Customer,
  RetailerBranch,
  RetailerStaffMember,
} from "@paon/domain";
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
  branches,
  defaultCustomerId,
}: {
  customers: readonly Customer[];
  staff: readonly RetailerStaffMember[];
  branches: readonly RetailerBranch[];
  defaultCustomerId?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    createAppointment,
    initialCreateAppointmentFormState,
  );
  const v = state.values;
  const defaultBranchId =
    branches.find((branch) => branch.isDefault)?.id ?? branches[0]?.id ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.formError ? (
        <p
          role="alert"
          className="bg-[var(--color-danger-500)]/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-[var(--color-danger-500)]"
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
              defaultValue={v["customerId"] ?? defaultCustomerId ?? ""}
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
                  {APPOINTMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Branch"
            htmlFor="branchId"
            hint="Times are interpreted in this branch timezone"
            error={state.fieldErrors["branchId"]}
          >
            <Select
              id="branchId"
              name="branchId"
              defaultValue={v["branchId"] ?? defaultBranchId}
            >
              {branches.length === 0 ? (
                <option value="">No branch (UTC)</option>
              ) : (
                branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} · {branch.timezone}
                  </option>
                ))
              )}
            </Select>
          </FormField>
          <FormField
            label="Starts"
            htmlFor="startsAt"
            labelledGroup
            hint="Branch local time"
            error={state.fieldErrors["startsAt"]}
          >
            <DateTimePicker
              name="startsAt"
              label="Starts"
              defaultValue={v["startsAt"]}
            />
          </FormField>
          <FormField
            label="Ends"
            htmlFor="endsAt"
            labelledGroup
            error={state.fieldErrors["endsAt"]}
          >
            <DateTimePicker
              name="endsAt"
              label="Ends"
              defaultValue={v["endsAt"]}
            />
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
