"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import { resolveManualConceptCode, type ManualCodeEntryState } from "./actions";

const initial: ManualCodeEntryState = {};

/** The blueprint's mandatory manual-entry path — not a camera fallback,
 * a first-class way in. A scanned QR lands on the same
 * `/concepts/[code]` route this form navigates to. */
export function ManualCodeEntryForm({ slug }: { slug: string }) {
  const boundAction = resolveManualConceptCode.bind(null, slug);
  const [state, formAction, isPending] = useActionState(boundAction, initial);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm">
        <span>Enter the code from your Try-On or swatch tag</span>
        <input
          name="code"
          placeholder="e.g. 4F2A9B1C"
          className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 py-2 uppercase"
          autoCapitalize="characters"
          required
        />
      </label>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Looking up…" : "Find piece"}
      </Button>
      {state.formError ? (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
