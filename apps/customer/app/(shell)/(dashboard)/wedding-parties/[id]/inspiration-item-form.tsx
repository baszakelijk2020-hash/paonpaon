"use client";

import { buttonVariants } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  addWeddingInspirationItem,
  type AddInspirationItemState,
} from "../actions";

const initial: AddInspirationItemState = {};

export function InspirationItemForm({
  weddingPartyId,
}: {
  weddingPartyId: string;
}) {
  const boundAction = addWeddingInspirationItem.bind(null, weddingPartyId);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input
        type="url"
        name="imageRef"
        placeholder="Image link (optional)"
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm text-[var(--color-stone-900)]"
      />
      <input
        type="text"
        name="note"
        placeholder="Note (optional)"
        className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-3 text-sm text-[var(--color-stone-900)]"
      />
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
        {isPending ? "Pinning…" : "Pin inspiration"}
      </button>
    </form>
  );
}
