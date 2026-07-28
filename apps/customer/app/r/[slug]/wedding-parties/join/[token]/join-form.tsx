"use client";

import { WEDDING_PARTY_MEMBER_ROLES } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import { joinWeddingParty, type JoinPartyState } from "./actions";

const initial: JoinPartyState = {};

export function JoinForm({ token }: { token: string }) {
  const boundAction = joinWeddingParty.bind(null, token);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  if (state.joined) {
    return (
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-[var(--color-stone-700)]"
      >
        You&rsquo;re in — the team can now see you as part of the party and will
        follow up to schedule your fitting.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Your name" htmlFor="name">
        <Input id="name" name="name" required autoComplete="name" />
      </FormField>
      <FormField label="Your email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
      </FormField>
      <FormField label="Your role" htmlFor="role">
        <Select id="role" name="role" defaultValue="groomsman">
          {WEDDING_PARTY_MEMBER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="Height (cm)"
          htmlFor="heightCm"
          hint="So the atelier can pull sample garments"
        >
          <Input
            id="heightCm"
            name="heightCm"
            type="number"
            inputMode="decimal"
            min={100}
            max={250}
            step="0.1"
            required
            placeholder="180"
          />
        </FormField>
        <FormField label="Weight (kg)" htmlFor="weightKg">
          <Input
            id="weightKg"
            name="weightKg"
            type="number"
            inputMode="decimal"
            min={30}
            max={300}
            step="0.1"
            required
            placeholder="78"
          />
        </FormField>
      </div>
      <FormField
        label="Your photo"
        htmlFor="photo"
        hint="Clear head-and-shoulders helps the fitting party"
      >
        <Input
          id="photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          aria-label="Your photo"
        />
      </FormField>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Joining…" : "Join the party"}
      </Button>
    </form>
  );
}
