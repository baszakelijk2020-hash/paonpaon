"use client";

import {
  ACADEMY_ROLEPLAY_PERSONA_LABELS,
  ACADEMY_ROLEPLAY_PERSONAS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { FormField } from "@paon/ui/components/FormField";
import { Input } from "@paon/ui/components/Input";
import { Select } from "@paon/ui/components/Select";
import { useActionState } from "react";

import {
  moderateContribution,
  recordRoleplayGrade,
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

export interface StaffOption {
  readonly id: string;
  readonly label: string;
}

/**
 * A manager grades a roleplay, always citing what was actually observed.
 * One criterion per submission keeps the form simple; grading the same
 * lesson again adds a second row rather than editing the first, which
 * matches the table's own append-only design.
 */
export interface RoleplaySessionOption {
  readonly id: string;
  readonly label: string;
}

export function RecordRoleplayGradeForm({
  staff,
  roleplaySessions,
}: {
  readonly staff: readonly StaffOption[];
  readonly roleplaySessions: readonly RoleplaySessionOption[];
}) {
  const [state, action, pending] = useActionState(recordRoleplayGrade, initial);

  return (
    <form action={action} className="mt-3 flex flex-col gap-4" id="grade-form">
      <FormField htmlFor="grade-staff" label="Staff member">
        <Select id="grade-staff" name="staffId" defaultValue="">
          <option value="" disabled>
            Choose a staff member
          </option>
          {staff.map((member) => (
            <option key={member.id} value={member.id}>
              {member.label}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField htmlFor="grade-lesson" label="Lesson">
        <Input
          id="grade-lesson"
          name="lessonKey"
          placeholder="e.g., fitting-room-consultation"
          disabled={pending}
        />
      </FormField>
      <FormField htmlFor="grade-persona" label="Persona practiced (optional)">
        <Select id="grade-persona" name="personaKey" defaultValue="">
          <option value="">No specific persona</option>
          {ACADEMY_ROLEPLAY_PERSONAS.map((persona) => (
            <option key={persona} value={persona}>
              {ACADEMY_ROLEPLAY_PERSONA_LABELS[persona]}
            </option>
          ))}
        </Select>
      </FormField>
      {roleplaySessions.length > 0 ? (
        <FormField
          htmlFor="grade-roleplay-session"
          label="Real AI-practice transcript reviewed (optional)"
        >
          <Select
            id="grade-roleplay-session"
            name="roleplaySessionId"
            defaultValue=""
          >
            <option value="">Not from a recorded session</option>
            {roleplaySessions.map((rp) => (
              <option key={rp.id} value={rp.id}>
                {rp.label}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}
      <FormField htmlFor="grade-criterion" label="Criterion">
        <Input
          id="grade-criterion"
          name="criterionKey"
          placeholder="e.g., opened-with-a-question"
          disabled={pending}
        />
      </FormField>
      <FormField htmlFor="grade-evidence-ref" label="Where this was observed">
        <Input
          id="grade-evidence-ref"
          name="evidenceRef"
          placeholder="e.g., roleplay-2026-08-04-am"
          disabled={pending}
        />
      </FormField>
      <FormField htmlFor="grade-observed" label="What was actually observed">
        <textarea
          id="grade-observed"
          name="observedBehaviour"
          required
          minLength={10}
          rows={3}
          placeholder="Describe the specific behaviour — not a rating."
          disabled={pending}
          className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-stone-400)]"
        />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          Record grade
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
