"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  advanceCoachingLoop,
  approveShiftSwap,
  declareAvailability,
  publishCeremonyVersion,
  publishCoveragePlan,
  recordCoachingObservation,
  requestShiftSwap,
  respondToShiftSwap,
  withdrawShiftSwap,
  type CoverageActionState,
} from "./actions";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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
      <CoverageBand
        label="morning"
        headcountName="morningHeadcount"
        skillName="morningSkill"
      />
      <CoverageBand
        label="afternoon"
        headcountName="afternoonHeadcount"
        skillName="afternoonSkill"
      />
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Publishing…" : "Publish coverage"}
        </Button>
      </div>
      <div className="md:col-span-2">
        <Result state={state} />
      </div>
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
        <input
          className={fieldClass}
          type="number"
          min="0"
          step="1"
          name={headcountName}
          defaultValue="0"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Required skill (optional)
        <input className={fieldClass} name={skillName} />
      </label>
    </fieldset>
  );
}

const CEREMONY_STEP_SLOTS = [0, 1, 2, 3, 4];

export function CeremonyForm() {
  const [state, action, pending] = useActionState(
    publishCeremonyVersion,
    initial,
  );
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Ceremony name
        <input
          className={fieldClass}
          name="ceremonyKey"
          placeholder="e.g. fitting_greeting"
          required
        />
      </label>
      {CEREMONY_STEP_SLOTS.map((slot) => (
        <fieldset
          key={slot}
          className="flex flex-col gap-2 rounded border border-[var(--color-stone-100)] p-3"
        >
          <legend className="px-1 text-sm font-medium">
            Step {slot + 1} (leave blank to skip)
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            Key
            <input className={fieldClass} name={`stepKey${slot}`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input className={fieldClass} name={`stepTitle${slot}`} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Guidance
            <textarea
              className={fieldClass}
              name={`stepGuidance${slot}`}
              rows={2}
            />
          </label>
        </fieldset>
      ))}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Publishing…" : "Publish new version"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function AvailabilityForm({
  defaultEffectiveOn,
}: {
  readonly defaultEffectiveOn: string;
}) {
  const [state, action, pending] = useActionState(declareAvailability, initial);
  return (
    <form action={action} className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Effective from
        <input
          className={fieldClass}
          type="date"
          name="effectiveOn"
          defaultValue={defaultEffectiveOn}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Day of week
        <select className={fieldClass} name="weekday" defaultValue="1">
          {WEEKDAY_LABELS.map((label, index) => (
            <option key={label} value={index}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Start time
        <input
          className={fieldClass}
          type="time"
          name="startTime"
          defaultValue="09:00"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        End time
        <input
          className={fieldClass}
          type="time"
          name="endTime"
          defaultValue="17:00"
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Availability
        <select className={fieldClass} name="available" defaultValue="true">
          <option value="true">Available</option>
          <option value="false">Not available</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <input className={fieldClass} name="note" maxLength={500} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save availability"}
        </Button>
      </div>
      <div className="md:col-span-2">
        <Result state={state} />
      </div>
    </form>
  );
}

export function SwapRequestForm({
  myShifts,
  team,
}: {
  readonly myShifts: readonly { readonly id: string; readonly label: string }[];
  readonly team: readonly { readonly id: string; readonly fullName: string }[];
}) {
  const [state, action, pending] = useActionState(requestShiftSwap, initial);
  if (myShifts.length === 0 || team.length === 0) return null;
  return (
    <form action={action} className="mt-3 grid gap-3 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Your shift
        <select name="shiftId" className={fieldClass} required>
          {myShifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Swap with
        <select name="peerStaffId" className={fieldClass} required>
          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Reason (optional)
        <input className={fieldClass} name="reason" maxLength={500} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Requesting…" : "Request swap"}
        </Button>
      </div>
      <div className="md:col-span-2">
        <Result state={state} />
      </div>
    </form>
  );
}

export function SwapResponseForm({ swapId }: { readonly swapId: string }) {
  const [state, action, pending] = useActionState(respondToShiftSwap, initial);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="swapId" value={swapId} />
      <div className="flex gap-2">
        <Button
          type="submit"
          name="decision"
          value="accept"
          size="sm"
          disabled={pending}
        >
          Accept
        </Button>
        <Button
          type="submit"
          name="decision"
          value="decline"
          size="sm"
          variant="ghost"
          disabled={pending}
        >
          Decline
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function WithdrawSwapForm({ swapId }: { readonly swapId: string }) {
  const [state, action, pending] = useActionState(withdrawShiftSwap, initial);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="swapId" value={swapId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending}>
        Withdraw
      </Button>
      <Result state={state} />
    </form>
  );
}

export function ApproveSwapForm({ swapId }: { readonly swapId: string }) {
  const [state, action, pending] = useActionState(approveShiftSwap, initial);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="swapId" value={swapId} />
      <Button type="submit" size="sm" disabled={pending}>
        Approve swap
      </Button>
      <Result state={state} />
    </form>
  );
}

export function ObservationForm({
  planDate,
  team,
}: {
  readonly planDate: string;
  readonly team: readonly { readonly id: string; readonly fullName: string }[];
}) {
  const [state, action, pending] = useActionState(
    recordCoachingObservation,
    initial,
  );
  return (
    <form action={action} className="mt-3 flex flex-col gap-3">
      <input type="hidden" name="observedOn" value={planDate} />
      <label className="flex flex-col gap-1 text-sm">
        Colleague
        <select name="observedStaffId" className={fieldClass} required>
          {team.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What you actually saw
        <textarea
          name="evidence"
          minLength={10}
          required
          rows={3}
          className={fieldClass}
        />
      </label>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Recording…" : "Record observation"}
        </Button>
      </div>
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
  const [result, action, pending] = useActionState(
    advanceCoachingLoop,
    initial,
  );
  const next =
    state === "observed"
      ? "discussed"
      : state === "discussed"
        ? "plan_agreed"
        : "outcome_recorded";
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="observationId" value={observationId} />
      <input type="hidden" name="next" value={next} />
      {state === "discussed" ? (
        <input
          name="agreedAction"
          placeholder="Action you both agreed"
          className={fieldClass}
        />
      ) : null}
      {state === "plan_agreed" ? (
        <input
          name="outcomeNote"
          placeholder="What changed afterwards"
          className={fieldClass}
        />
      ) : null}
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {state === "observed"
            ? "Mark as discussed"
            : state === "discussed"
              ? "Agree a plan"
              : "Record the outcome"}
        </Button>
      </div>
      <Result state={result} />
    </form>
  );
}
