"use client";

import type { BranchOpeningHoursEntry } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { useActionState, useMemo, useState } from "react";

import { bookAppointment, type BookAppointmentState } from "./booking-actions";
import { APPOINTMENT_REASONS, type AppointmentReason } from "./booking-reasons";

export interface BookableBranch {
  readonly id: string;
  readonly name: string;
  readonly openingHours: readonly BranchOpeningHoursEntry[];
}

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function nextDates(count: number): Date[] {
  const dates: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 1; i <= count; i += 1) {
    dates.push(new Date(start.getTime() + i * 24 * 60 * 60 * 1000));
  }
  return dates;
}

function timesForDay(branch: BookableBranch, date: Date): readonly string[] {
  const dayKey = DAY_KEYS[date.getDay()]!;
  const entry = branch.openingHours.find((row) => row.day === dayKey);
  if (!entry || entry.closed || !entry.opens || !entry.closes) return [];

  const [openHour, openMinute] = entry.opens.split(":").map(Number);
  const [closeHour, closeMinute] = entry.closes.split(":").map(Number);
  if (
    openHour === undefined ||
    openMinute === undefined ||
    closeHour === undefined ||
    closeMinute === undefined
  ) {
    return [];
  }

  const times: string[] = [];
  let cursor = openHour * 60 + openMinute;
  const end = closeHour * 60 + closeMinute;
  while (cursor + 60 <= end) {
    const hour = Math.floor(cursor / 60);
    const minute = cursor % 60;
    times.push(
      `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
    cursor += 60;
  }
  return times;
}

type Step = "reason" | "location" | "date" | "time" | "review" | "confirmed";

const initialState: BookAppointmentState = { fieldErrors: {} };

/**
 * My Appointments' new booking flow (contract §6): reason -> location ->
 * date -> time -> review -> confirmed, replacing one step with the next
 * rather than a long form. Location/date/time are real branch opening
 * hours — not invented availability. Double-booking across staff is not
 * modelled here; a branch-level slot is offered whenever it falls inside
 * that branch's published hours.
 */
export function BookingFlow({
  retailerId,
  branches,
  initialReason,
  purpose,
  wardrobeItemId,
  roadmapGapId,
  onCloseAction,
}: {
  retailerId: string;
  branches: readonly BookableBranch[];
  initialReason?: AppointmentReason;
  purpose?: string;
  /** Wardrobe-originated context (DeepSeek remediation Cards 1-2) — passed
   * through as hidden fields only; `booking-actions.ts` independently
   * re-resolves and re-authorizes whichever one is present before it ever
   * touches the persisted appointment's notes. */
  wardrobeItemId?: string;
  roadmapGapId?: string;
  onCloseAction: () => void;
}) {
  const [step, setStep] = useState<Step>(initialReason ? "location" : "reason");
  const [reason, setReason] = useState<AppointmentReason | null>(
    initialReason ?? null,
  );
  const [branchId, setBranchId] = useState<string | null>(
    branches.length === 1 ? branches[0]!.id : null,
  );
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(
    bookAppointment,
    initialState,
  );

  const branch = branches.find((b) => b.id === branchId) ?? null;
  const dates = useMemo(() => nextDates(21), []);
  const availableTimes = date && branch ? timesForDay(branch, date) : [];
  const reasonLabel = APPOINTMENT_REASONS.find(
    (r) => r.value === reason,
  )?.label;

  const startsAtIso =
    date && time
      ? (() => {
          const [hour, minute] = time.split(":").map(Number);
          const combined = new Date(date);
          combined.setHours(hour ?? 0, minute ?? 0, 0, 0);
          return combined.toISOString();
        })()
      : null;

  if (state.success) {
    return (
      <div className="flex flex-col gap-3 rounded-[15px] bg-[var(--color-stone-900)] p-6 text-white">
        <p className="font-display text-xl">Appointment requested</p>
        <p className="text-sm text-[var(--color-stone-300)]">
          Your advisor will confirm the exact time.
        </p>
        <Button size="sm" onClick={onCloseAction} className="self-start">
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[15px] bg-[var(--color-stone-900)] p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-xl">Book an appointment</p>
          {purpose ? (
            <p className="mt-1 text-sm text-[var(--color-stone-300)]">
              {purpose}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCloseAction}
          className="text-xs text-[var(--color-stone-400)] underline"
        >
          Cancel
        </button>
      </div>

      {step === "reason" ? (
        <div className="flex flex-col gap-2">
          {APPOINTMENT_REASONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setReason(option.value);
                setStep("location");
              }}
              className="rounded-[10px] bg-white/[0.06] px-4 py-3 text-left text-sm"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {step === "location" ? (
        <div className="flex flex-col gap-2">
          {branches.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-400)]">
              No branches configured yet.
            </p>
          ) : (
            branches.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setBranchId(option.id);
                  setStep("date");
                }}
                className="rounded-[10px] bg-white/[0.06] px-4 py-3 text-left text-sm"
              >
                {option.name}
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => setStep("reason")}
            className="self-start text-xs text-[var(--color-stone-400)] underline"
          >
            Back
          </button>
        </div>
      ) : null}

      {step === "date" && branch ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {dates.map((candidate) => {
              const hasHours = timesForDay(branch, candidate).length > 0;
              return (
                <button
                  key={candidate.toISOString()}
                  type="button"
                  disabled={!hasHours}
                  onClick={() => {
                    setDate(candidate);
                    setStep("time");
                  }}
                  className="rounded-[10px] bg-white/[0.06] px-2 py-2 text-xs disabled:opacity-30"
                >
                  {DATE_FORMATTER.format(candidate)}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep("location")}
            className="self-start text-xs text-[var(--color-stone-400)] underline"
          >
            Back
          </button>
        </div>
      ) : null}

      {step === "time" && date ? (
        <div className="flex flex-col gap-2">
          {availableTimes.length === 0 ? (
            <p className="text-sm text-[var(--color-stone-400)]">
              No real availability that day — choose another date.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {availableTimes.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setTime(option);
                    setStep("review");
                  }}
                  className="rounded-[10px] bg-white/[0.06] px-2 py-2 text-xs"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setStep("date")}
            className="self-start text-xs text-[var(--color-stone-400)] underline"
          >
            Back
          </button>
        </div>
      ) : null}

      {step === "review" && startsAtIso && branch ? (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="retailerId" value={retailerId} />
          <input type="hidden" name="reason" value={reason ?? ""} />
          <input type="hidden" name="branchId" value={branch.id} />
          <input type="hidden" name="startsAt" value={startsAtIso} />
          {wardrobeItemId ? (
            <input type="hidden" name="wardrobeItemId" value={wardrobeItemId} />
          ) : null}
          {roadmapGapId ? (
            <input type="hidden" name="roadmapGapId" value={roadmapGapId} />
          ) : null}
          <div className="rounded-[10px] bg-white/[0.06] p-4 text-sm">
            {purpose ? <p>{purpose}</p> : null}
            <p>{reasonLabel}</p>
            <p className="text-[var(--color-stone-300)]">{branch.name}</p>
            <p className="text-[var(--color-stone-300)]">
              {date ? DATE_FORMATTER.format(date) : ""} · {time}
            </p>
          </div>
          {state.formError ? (
            <p role="alert" className="text-sm text-[var(--color-danger-500)]">
              {state.formError}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="rounded-[15px]"
            >
              {isPending ? "Booking…" : "Confirm"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("time")}
              className="text-xs text-[var(--color-stone-400)] underline"
            >
              Back
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
