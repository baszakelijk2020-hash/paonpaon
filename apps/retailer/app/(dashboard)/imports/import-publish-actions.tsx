"use client";

import { Button } from "@paon/ui/components/Button";
import { useActionState } from "react";

import {
  publishImportReadyRows,
  publishImportRow,
  reviewImportTask,
  type ImportPublishState,
} from "./actions";

const initialState: ImportPublishState = {};

export function ReviewTaskActions({
  importId,
  taskId,
}: {
  importId: string;
  taskId: string;
}) {
  const [state, action, pending] = useActionState(
    reviewImportTask,
    initialState,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["accepted", "rejected", "dismissed"] as const).map((status) => (
        <form action={action} key={status}>
          <input type="hidden" name="importId" value={importId} />
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="status" value={status} />
          <Button type="submit" variant="outline" disabled={pending}>
            Mark {status}
          </Button>
        </form>
      ))}
      {state.formError ? (
        <p
          role="alert"
          className="w-full text-sm text-[var(--color-danger-500)]"
        >
          {state.formError}
        </p>
      ) : null}
      {state.message ? (
        <p
          role="status"
          className="w-full text-sm text-[var(--color-stone-500)]"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function PublishRowButton({
  importId,
  importRowId,
  disabled,
}: {
  importId: string;
  importRowId: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(
    publishImportRow,
    initialState,
  );

  return (
    <div className="grid gap-2">
      <form action={action}>
        <input type="hidden" name="importId" value={importId} />
        <input type="hidden" name="importRowId" value={importRowId} />
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Publishing…" : "Publish row"}
        </Button>
      </form>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

export function PublishReadyRowsButton({
  importId,
  disabled,
  label,
}: {
  importId: string;
  disabled?: boolean;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    publishImportReadyRows,
    initialState,
  );

  return (
    <div className="grid gap-2">
      <form action={action}>
        <input type="hidden" name="importId" value={importId} />
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Publishing reviewed rows…" : label}
        </Button>
      </form>
      {state.formError ? (
        <p role="alert" className="text-sm text-[var(--color-danger-500)]">
          {state.formError}
        </p>
      ) : null}
      {state.message ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
