"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState, useState } from "react";

import { correctOwnFact, type CorrectionFormState } from "./actions";

const initial: CorrectionFormState = {};

/**
 * The source fact is never edited in place — confirming here writes an
 * additive counterfact that supersedes it, so the House keeps both what
 * was recorded and what the customer says is actually true.
 */
export function CorrectionForm({
  factId,
  currentLabel,
}: {
  readonly factId: string;
  readonly currentLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    correctOwnFact.bind(null, factId),
    initial,
  );

  if (state.success) {
    return (
      <p role="status" className="text-xs text-[var(--color-stone-500)]">
        Thanks — we&apos;ve updated this.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--color-stone-500)] underline underline-offset-2 hover:text-[var(--color-stone-900)]"
      >
        This isn&apos;t right
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-stone-500)]">
          What should this say instead of &ldquo;{currentLabel}&rdquo;?
        </span>
        <input
          name="replacementValueLabel"
          required
          maxLength={500}
          className="rounded-[var(--customer-radius)] border border-[var(--customer-border)] p-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-[var(--color-stone-500)]">
          Anything else we should know? (optional)
        </span>
        <textarea
          name="reason"
          maxLength={2000}
          className="min-h-16 rounded-[var(--customer-radius)] border border-[var(--customer-border)] p-2 text-sm"
        />
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send correction"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--color-stone-500)] hover:text-[var(--color-stone-900)]"
        >
          Cancel
        </button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
