"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  approvePayrollPeriod,
  correctPayrollEntry,
  openPayrollPeriod,
  recordPayrollExport,
  resolvePayrollException,
  type PayrollActionState,
} from "./actions";

const initial: PayrollActionState = {};
const fieldClass =
  "rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm";

function Result({ state }: { readonly state: PayrollActionState }) {
  return state.formError ? (
    <p role="alert" className="text-sm text-[var(--color-danger-500)]">
      {state.formError}
    </p>
  ) : state.notice ? (
    <p role="status" className="text-sm text-[var(--color-stone-500)]">
      {state.notice}
    </p>
  ) : null;
}

export function OpenPayrollPeriodForm({
  defaultStart,
  defaultEnd,
}: {
  readonly defaultStart: string;
  readonly defaultEnd: string;
}) {
  const [state, action, pending] = useActionState(openPayrollPeriod, initial);
  return (
    <form action={action} className="mt-3 grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        Period starts
        <input
          className={fieldClass}
          type="date"
          name="periodStart"
          defaultValue={defaultStart}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Period ends
        <input
          className={fieldClass}
          type="date"
          name="periodEnd"
          defaultValue={defaultEnd}
          required
        />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Opening…" : "Open payroll period"}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Result state={state} />
      </div>
    </form>
  );
}

export function ResolvePayrollExceptionForm({
  exceptionId,
}: {
  readonly exceptionId: string;
}) {
  const [state, action, pending] = useActionState(
    resolvePayrollException,
    initial,
  );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="exceptionId" value={exceptionId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Resolving…" : "Resolve exception"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function CorrectPayrollEntryForm({
  periodId,
  sourceTimeEntryId,
  clockInAt,
  clockOutAt,
}: {
  readonly periodId: string;
  readonly sourceTimeEntryId: string;
  readonly clockInAt: string;
  readonly clockOutAt: string | null;
}) {
  const [state, action, pending] = useActionState(correctPayrollEntry, initial);
  return (
    <form action={action} className="mt-3 grid gap-3 md:grid-cols-2">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="sourceTimeEntryId" value={sourceTimeEntryId} />
      <label className="flex flex-col gap-1 text-sm">
        Clock-in
        <input
          className={fieldClass}
          type="datetime-local"
          name="clockInAt"
          defaultValue={toLocalInput(clockInAt)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Clock-out
        <input
          className={fieldClass}
          type="datetime-local"
          name="clockOutAt"
          defaultValue={clockOutAt ? toLocalInput(clockOutAt) : ""}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Correction reason
        <textarea
          className={fieldClass}
          name="reason"
          rows={2}
          maxLength={1000}
          required
          placeholder="Why this historical time entry is being corrected"
        />
      </label>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Correct entry"}
        </Button>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ApprovePayrollPeriodForm({
  periodId,
}: {
  readonly periodId: string;
}) {
  const [state, action, pending] = useActionState(
    approvePayrollPeriod,
    initial,
  );
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="periodId" value={periodId} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Approving…" : "Approve period"}
      </Button>
      <Result state={state} />
    </form>
  );
}

export function RecordPayrollExportForm({
  versionId,
}: {
  readonly versionId: string;
}) {
  const [state, action, pending] = useActionState(recordPayrollExport, initial);
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="versionId" value={versionId} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Recording…" : "Record checksummed export"}
      </Button>
      <Result state={state} />
    </form>
  );
}

function toLocalInput(value: string): string {
  return value.slice(0, 16);
}
