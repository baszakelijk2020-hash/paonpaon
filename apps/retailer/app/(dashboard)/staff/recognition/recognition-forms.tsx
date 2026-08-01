"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  reviewRecognitionAct,
  submitRecognitionAct,
  type RecognitionActionState,
} from "./actions";

const initial: RecognitionActionState = {};

export interface TeamOption {
  readonly id: string;
  readonly fullName: string;
}

/** Log an extra-mile act — available to every retailer role. */
export function SubmitRecognitionForm({
  team,
  defaultStaffId,
}: {
  readonly team: readonly TeamOption[];
  readonly defaultStaffId: string;
}) {
  const [state, action, pending] = useActionState(
    submitRecognitionAct,
    initial,
  );

  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Who went the extra mile
        <select
          name="staffId"
          defaultValue={defaultStaffId}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2"
        >
          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What happened
        <textarea
          name="narrative"
          rows={3}
          required
          minLength={10}
          maxLength={2000}
          placeholder="Stayed late to re-press a jacket before a client's flight."
          className="rounded border border-[var(--color-stone-200)] px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        When
        <input
          type="date"
          name="occurredOn"
          defaultValue={new Date().toISOString().slice(0, 10)}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2"
        />
      </label>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Logging…" : "Log act"}
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

/** Manager review of one act: acknowledge, coach (note required) or dismiss. */
export function ReviewRecognitionForm({ actId }: { readonly actId: string }) {
  const [state, action, pending] = useActionState(
    reviewRecognitionAct,
    initial,
  );

  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="actId" value={actId} />
      <input
        name="coachingNote"
        maxLength={2000}
        placeholder="Coaching note (required to coach)"
        className="rounded border border-[var(--color-stone-200)] px-3 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          name="nextState"
          value="acknowledged"
          size="sm"
          disabled={pending}
        >
          Acknowledge
        </Button>
        <Button
          type="submit"
          name="nextState"
          value="coached"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          Coach
        </Button>
        <Button
          type="submit"
          name="nextState"
          value="dismissed"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          Dismiss
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
