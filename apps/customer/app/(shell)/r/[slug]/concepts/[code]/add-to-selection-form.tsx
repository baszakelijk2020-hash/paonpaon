"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  addConceptScanSelection,
  type AddConceptSelectionState,
} from "../actions";

const initial: AddConceptSelectionState = {};

export function AddToSelectionForm({
  slug,
  retailerId,
  code,
}: {
  slug: string;
  retailerId: string;
  code: string;
}) {
  const boundAction = addConceptScanSelection.bind(
    null,
    slug,
    retailerId,
    code,
  );
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  if (state.success) {
    return (
      <p
        role="status"
        className="text-sm font-medium text-[var(--color-stone-700)]"
      >
        Added to your concept list.
      </p>
    );
  }

  return (
    <form action={formAction}>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Adding…" : "Add to my concept list"}
      </Button>
      {state.formError ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
