"use client";

import { INVITABLE_RETAILER_ROLES, RETAILER_ROLE_LABELS } from "@paon/domain";
import type { Workshop } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { inviteStaff, type InviteStaffFormState } from "./actions";

const initialInviteStaffFormState: InviteStaffFormState = {
  values: {},
  fieldErrors: {},
};

export function StaffForm({ workshops }: { workshops: readonly Workshop[] }) {
  const [state, formAction, isPending] = useActionState(
    inviteStaff,
    initialInviteStaffFormState,
  );
  const v = state.values;

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

      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Full name"
            htmlFor="fullName"
            error={state.fieldErrors["fullName"]}
          >
            <Input
              id="fullName"
              name="fullName"
              defaultValue={v["fullName"]}
              invalid={!!state.fieldErrors["fullName"]}
              required
            />
          </FormField>
          <FormField
            label="Workshop"
            htmlFor="workshopId"
            hint="Required for workshop manager and worker roles"
            error={state.fieldErrors["workshopId"]}
          >
            <Select
              id="workshopId"
              name="workshopId"
              defaultValue={v["workshopId"] ?? ""}
            >
              <option value="">No workshop</option>
              {workshops.map((workshop) => (
                <option key={workshop.id} value={workshop.id}>
                  {workshop.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Email"
            htmlFor="email"
            error={state.fieldErrors["email"]}
          >
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={v["email"]}
              invalid={!!state.fieldErrors["email"]}
              required
            />
          </FormField>
          <FormField
            label="Role"
            htmlFor="role"
            error={state.fieldErrors["role"]}
          >
            <Select
              id="role"
              name="role"
              defaultValue={v["role"] ?? "read_only"}
            >
              {INVITABLE_RETAILER_ROLES.map((role) => (
                <option key={role} value={role}>
                  {RETAILER_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      </Card>

      <div className="bg-[var(--color-stone-50)]/95 sticky bottom-20 z-20 -mx-4 mt-6 flex justify-end border-t border-[var(--color-stone-200)] px-4 py-4 backdrop-blur xl:static xl:mx-0 xl:border-0 xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Sending invite…" : "Send invite"}
        </Button>
      </div>
    </form>
  );
}
