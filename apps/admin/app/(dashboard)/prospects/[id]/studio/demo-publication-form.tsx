"use client";

import { ConfirmSubmitButton } from "@paon/ui/components/ConfirmSubmitButton";
import { useActionState } from "react";

import { setDemoPublication, type DemoPublicationActionState } from "./actions";

const initial: DemoPublicationActionState = {};

export function DemoPublicationForm({
  prospectId,
  status,
}: {
  prospectId: string;
  status: "draft" | "published" | "revoked" | "expired";
}) {
  const [state, action, pending] = useActionState(setDemoPublication, initial);

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="prospectId" value={prospectId} />
      <input
        type="hidden"
        name="publish"
        value={status === "published" ? "false" : "true"}
      />
      {status === "published" ? (
        <ConfirmSubmitButton
          confirmMessage="Revoke this private demo? The link stops working immediately for the prospect."
          disabled={pending}
          className="min-h-11 rounded-[var(--radius-md)] bg-white px-5 text-sm text-black hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? "Revoking…" : "Revoke private demo"}
        </ConfirmSubmitButton>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-[var(--radius-md)] bg-white px-5 text-sm text-black disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish private demo"}
        </button>
      )}
      {state.formError ? (
        <p role="alert" className="text-xs text-white/60">
          {state.formError}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-xs text-white/60">
          Demo publication status updated.
        </p>
      ) : null}
    </form>
  );
}
