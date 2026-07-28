"use client";

import type { Retailer } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { createWeddingParty, type CreateWeddingPartyState } from "../actions";

const initialState: CreateWeddingPartyState = {};

export function NewWeddingPartyForm({
  retailers,
}: {
  retailers: readonly Retailer[];
}) {
  const [state, formAction, isPending] = useActionState(
    createWeddingParty,
    initialState,
  );

  return (
    <Card className="paon-reveal flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        {retailers.length > 1 ? (
          <FormField label="Atelier" htmlFor="retailerId">
            <Select id="retailerId" name="retailerId" required>
              {retailers.map((retailer) => (
                <option key={retailer.id} value={retailer.id}>
                  {retailer.displayName}
                </option>
              ))}
            </Select>
          </FormField>
        ) : (
          <input type="hidden" name="retailerId" value={retailers[0]!.id} />
        )}
        <FormField label="Event date" htmlFor="eventDate" hint="Optional">
          <Input id="eventDate" name="eventDate" type="date" />
        </FormField>
        <FormField label="Venue" htmlFor="venueName" hint="Optional">
          <Input id="venueName" name="venueName" placeholder="Wedding venue" />
        </FormField>
        <FormField label="Notes" htmlFor="notes" hint="Optional">
          <Input id="notes" name="notes" />
        </FormField>
        {state.formError ? (
          <p role="alert" className="text-sm text-[var(--color-danger-500)]">
            {state.formError}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending} className="self-start">
          {isPending ? "Creating…" : "Create wedding party"}
        </Button>
      </form>
    </Card>
  );
}
