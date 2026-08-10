"use client";

import { Button } from "@paon/ui/components/Button";
import Link from "next/link";
import { useActionState } from "react";

import {
  requestConciergeAssistance,
  type ConciergeRequestState,
} from "./actions";

const initial: ConciergeRequestState = { fieldErrors: {} };
const fieldClass =
  "rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm";

export function ConciergeRequestForm({
  retailerId,
}: {
  readonly retailerId: string;
}) {
  const [state, action, pending] = useActionState(
    requestConciergeAssistance,
    initial,
  );

  if (state.success) {
    return (
      <div className="mt-3 text-sm" role="status">
        <p>Your request has been sent.</p>
        {state.conversationId ? (
          <Link
            href={`/messages?c=${state.conversationId}`}
            className="underline underline-offset-4"
          >
            View the conversation →
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="retailerId" value={retailerId} />
      <label className="flex flex-col gap-1 text-sm">
        What would you like arranged?
        <textarea
          className={fieldClass}
          name="detail"
          rows={3}
          minLength={10}
          required
          placeholder="e.g. Collect my order from the store and have it delivered Thursday."
        />
      </label>
      {state.fieldErrors.detail ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.fieldErrors.detail}
        </p>
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </div>
      {state.formError && !state.fieldErrors.detail ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
    </form>
  );
}
