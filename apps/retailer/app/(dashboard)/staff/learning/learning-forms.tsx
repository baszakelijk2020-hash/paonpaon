"use client";

import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { useActionState } from "react";

import {
  moderateContribution,
  submitContribution,
  type LearningActionState,
} from "./actions";

const initial: LearningActionState = {};

export function SubmitContributionForm() {
  const [state, action, pending] = useActionState(submitContribution, initial);

  return (
    <form action={action} className="mt-3 flex flex-col gap-4">
      <FormField htmlFor="title" label="Title">
        <Input
          id="title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          placeholder="e.g., How I handle a rush alteration request"
          disabled={pending}
        />
      </FormField>

      <FormField htmlFor="body" label="What you'd tell a new teammate">
        <textarea
          id="body"
          name="body"
          required
          minLength={40}
          maxLength={20000}
          placeholder="Write at least a few sentences — enough for someone else to actually learn from it."
          rows={5}
          disabled={pending}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
      </div>

      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}

export function ModerateContributionForm({
  contributionId,
}: {
  readonly contributionId: string;
}) {
  const [state, action, pending] = useActionState(
    moderateContribution,
    initial,
  );

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="contributionId" value={contributionId} />
      <textarea
        name="moderationNote"
        placeholder="Note (required to reject)"
        rows={2}
        disabled={pending}
        className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="nextState"
          value="approved"
          size="sm"
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="submit"
          name="nextState"
          value="rejected"
          variant="outline"
          size="sm"
          disabled={pending}
        >
          Reject
        </Button>
      </div>
      {state.formError ? (
        <p role="alert" className="text-xs text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-xs text-[var(--color-stone-500)]">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
