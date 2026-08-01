"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  advanceCoachingLoop,
  publishCoveragePlan,
  recordCoachingObservation,
  type CoverageActionState,
} from "./actions";

const initial: CoverageActionState = {};
const fieldClass =
  "rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm";

function Result({ state }: { readonly state: CoverageActionState }) {
  if (state.formError) {
    return (
      <p role="alert" className="text-sm text-[var(--color-danger-500)]">
        {state.formError}
      </p>
    );
  }
  return state.notice ? (
    <p role="status" className="text-sm text-[var(--color-stone-500)]">
      {state.notice}
    </p>
  ) : null;
}

export function CoveragePlanForm({ planDate }: { readonly planDate: string }) {
  const [state, action, pending] = useActionState(publishCoveragePlan, initial);
  return (
    <form action={action} className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Date
        <input
          className={fieldClass}
          type="date"
          name="planDate"
          defaultValue={planDate}
          required
        />
      </label>
      <CoverageBand label="morning" headcountName="morningHeadcount" skillName="morningSkill" />
      <CoverageBand label="afternoon" headcountName="afternoonHeadcount" skillName="afternoonSkill" />
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Publishing…" : "Publish coverage"}
        </Button>
      </div>
      <div className="md:col-span-2"><Result state={state} /></div>
    </form>
  );
}

function CoverageBand({
  label,
  headcountName,
  skillName,
}: {
  readonly label: string;
  readonly headcountName: string;
  readonly skillName: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded border border-[var(--color-stone-100)] p-3">
      <legend className="px-1 text-sm font-medium capitalize">{label}</legend>
      <label className="flex flex-col gap-1 text-sm">
        {label} headcount
        <input className={fieldClass} type="number" min="0" step="1" name={headcountName} defaultValue="0" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Required skill (optional)
        <input className={fieldClass} name={skillName} />
      </label>
    </fieldset>
  );
}

export function ObservationForm({
  planDate,
  team,
}: {
  readonly planDate: string;
  readonly team: readonly { readonly id: string; readonly fullName: string }[];
}) {
  const [state, action, pending] = useActionState(recordCoachingObservation, initial);
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="observedOn" value={planDate} />
      <label className="flex flex-col gap-1 text-sm">
        Colleague
        <select name="observedStaffId" className={fieldClass} required>
          {team.map((member) => <option key={member.id} value={member.id}>{member.fullName}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What you actually saw
        <textarea name="evidence" minLength={10} required rows={3} className={fieldClass} />
      </label>
      <div><Button type="submit" size="sm" disabled={pending}>{pending ? "Recording…" : "Record observation"}</Button></div>
      <Result state={state} />
    </form>
  );
}

export function CoachingStepForm({
  observationId,
  state,
}: {
  readonly observationId: string;
  readonly state: string;
}) {
  const [result, action, pending] = useActionState(advanceCoachingLoop, initial);
  const next = state === "observed" ? "discussed" : state === "discussed" ? "plan_agreed" : "outcome_recorded";
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="observationId" value={observationId} />
      <input type="hidden" name="next" value={next} />
      {state === "discussed" ? <input name="agreedAction" placeholder="Action you both agreed" className={fieldClass} /> : null}
      {state === "plan_agreed" ? <input name="outcomeNote" placeholder="What changed afterwards" className={fieldClass} /> : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {state === "observed" ? "Mark as discussed" : state === "discussed" ? "Agree a plan" : "Record the outcome"}
        </Button>
      </div>
      <Result state={result} />
    </form>
  );
}
