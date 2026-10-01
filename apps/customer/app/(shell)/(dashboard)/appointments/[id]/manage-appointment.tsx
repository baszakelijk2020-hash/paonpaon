"use client";

import { useActionState, useState } from "react";

import {
  cancelMyAppointment,
  rescheduleMyAppointment,
  type AppointmentManageState,
} from "../manage-actions";

const EMPTY: AppointmentManageState = {};

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in the viewer's own zone. */
function toLocalInputValue(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/**
 * Moving or cancelling an appointment. Both live behind a confirm step: these
 * are the two actions in this tab a customer cannot undo themselves, and the
 * retailer is notified the moment either goes through.
 */
export function ManageAppointment({
  appointmentId,
  startsAt,
  endsAt,
}: {
  readonly appointmentId: string;
  readonly startsAt: string;
  readonly endsAt: string;
}) {
  const [mode, setMode] = useState<"idle" | "move" | "cancel">("idle");
  const [moveState, moveAction] = useActionState(
    rescheduleMyAppointment,
    EMPTY,
  );
  const [cancelState, cancelAction] = useActionState(
    cancelMyAppointment,
    EMPTY,
  );

  const durationMs =
    Math.max(Date.parse(endsAt) - Date.parse(startsAt), 0) || 60 * 60 * 1000;

  return (
    <section className="customer-panel flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium uppercase text-[var(--color-stone-500)]">
          Need to change this?
        </p>
        <p className="text-sm text-[var(--color-stone-600)]">
          Move it to another time or cancel it. Your advisor is told either way.
        </p>
      </div>

      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="customer-button"
            onClick={() => setMode("move")}
          >
            Move this appointment
          </button>
          <button
            type="button"
            className="customer-button-quiet"
            onClick={() => setMode("cancel")}
          >
            Cancel it
          </button>
        </div>
      ) : null}

      {mode === "move" ? (
        <form action={moveAction} className="flex flex-col gap-3">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          {/* The end time follows the original duration, so a customer moving
              a 60-minute fitting cannot accidentally book 8 hours. */}
          <input
            type="hidden"
            name="endsAt"
            value={new Date(Date.parse(startsAt) + durationMs).toISOString()}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">New time</span>
            <input
              type="datetime-local"
              name="startsAt"
              required
              defaultValue={toLocalInputValue(startsAt)}
              className="rounded-xl border border-[var(--color-stone-200)] px-3 py-2"
              onChange={(event) => {
                const form = event.currentTarget.form;
                const ends = form?.elements.namedItem("endsAt");
                const start = Date.parse(event.currentTarget.value);
                if (
                  ends instanceof HTMLInputElement &&
                  Number.isFinite(start)
                ) {
                  ends.value = new Date(start + durationMs).toISOString();
                }
              }}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="customer-button">
              Confirm new time
            </button>
            <button
              type="button"
              className="customer-button-quiet"
              onClick={() => setMode("idle")}
            >
              Keep the original
            </button>
          </div>
          {moveState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {moveState.formError}
            </p>
          ) : null}
        </form>
      ) : null}

      {mode === "cancel" ? (
        <form action={cancelAction} className="flex flex-col gap-3">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-600)]">
              Anything we should know? (optional)
            </span>
            <input
              type="text"
              name="reason"
              maxLength={240}
              className="rounded-xl border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="customer-button">
              Yes, cancel it
            </button>
            <button
              type="button"
              className="customer-button-quiet"
              onClick={() => setMode("idle")}
            >
              Keep it
            </button>
          </div>
          {cancelState.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {cancelState.formError}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
