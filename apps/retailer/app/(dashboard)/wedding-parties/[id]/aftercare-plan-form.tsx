"use client";

import type { WeddingPartyMember } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createAftercarePlan, type CreateAftercarePlanState } from "../actions";

const initial: CreateAftercarePlanState = {};

export function AftercarePlanForm({
  weddingPartyId,
  members,
}: {
  weddingPartyId: string;
  members: readonly WeddingPartyMember[];
}) {
  const boundAction = createAftercarePlan.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormField label="Instruction" htmlFor="instruction">
        <Input
          id="instruction"
          name="instruction"
          required
          placeholder="Return rentals within 3 days of the event"
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Who" htmlFor="weddingPartyMemberId">
          <Select id="weddingPartyMemberId" name="weddingPartyMemberId">
            <option value="">Whole party</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due (optional)" htmlFor="dueOn">
          <Input id="dueOn" name="dueOn" type="date" />
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
        {isPending ? "Adding…" : "Add instruction"}
      </Button>
    </form>
  );
}
