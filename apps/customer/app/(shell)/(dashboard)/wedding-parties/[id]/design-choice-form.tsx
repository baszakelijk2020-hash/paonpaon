"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { setWeddingDesignChoice, type SetDesignChoiceState } from "../actions";

const initial: SetDesignChoiceState = {};

export function DesignChoiceForm({
  weddingPartyId,
  myMemberId,
  isOrganizer,
}: {
  weddingPartyId: string;
  myMemberId?: string;
  isOrganizer: boolean;
}) {
  const boundAction = setWeddingDesignChoice.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="text"
          name="slotKey"
          required
          placeholder="Slot (e.g. tie color)"
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm text-[var(--color-stone-900)]"
        />
        <input
          type="text"
          name="valueKey"
          required
          placeholder="Choice (e.g. burgundy)"
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm text-[var(--color-stone-900)]"
        />
      </div>
      {isOrganizer ? (
        <>
          <input type="hidden" name="coordinated" value="on" />
          <p className="text-xs text-[var(--color-stone-500)]">
            Sets this choice for the whole party.
          </p>
        </>
      ) : myMemberId ? (
        <input type="hidden" name="weddingPartyMemberId" value={myMemberId} />
      ) : null}
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {isPending ? "Saving…" : "Save choice"}
      </button>
    </form>
  );
}
