"use client";

import { WEDDING_PARTY_MEMBER_ROLES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { addWeddingPartyMember, type AddMemberState } from "../actions";

const initial: AddMemberState = {};

export function AddMemberForm({ weddingPartyId }: { weddingPartyId: string }) {
  const boundAction = addWeddingPartyMember.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Name" htmlFor="name">
          <Input id="name" name="name" required />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required />
        </FormField>
        <FormField label="Role" htmlFor="role">
          <Select id="role" name="role" defaultValue="groomsman">
            {WEDDING_PARTY_MEMBER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </FormField>
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button
        type="submit"
        size="sm"
        disabled={isPending}
        className="self-start"
      >
        {isPending ? "Adding…" : "Add member"}
      </Button>
    </form>
  );
}
