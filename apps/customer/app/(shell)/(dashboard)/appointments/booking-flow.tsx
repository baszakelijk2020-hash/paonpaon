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

/*
 * When the retailer has not set up branches yet, the calendar still opens:
 * the appointment is booked against the retailer with the house's standard
 * hours (Mon–Sat, 09:00–18:00) and no branch — `bookAppointment` treats
 * branchId as optional. The flow used to stop at "No branches configured
 * yet." with nowhere to go.
 */
const ATELIER_FALLBACK: BookableBranch = {
  id: "",
  name: "Atelier",
  openingHours: [
    { day: "monday", closed: false, opens: "09:00", closes: "18:00" },
    { day: "tuesday", closed: false, opens: "09:00", closes: "18:00" },
    { day: "wednesday", closed: false, opens: "09:00", closes: "18:00" },
    { day: "thursday", closed: false, opens: "09:00", closes: "18:00" },
    { day: "friday", closed: false, opens: "09:00", closes: "18:00" },
    { day: "saturday", closed: false, opens: "09:00", closes: "18:00" },
    { day: "sunday", closed: true },
  ],
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const WEEKDAY_HEADS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** First of the month, local time. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * The cells of a month view, Monday-first, padded with nulls so the first
 * of the month lands on its weekday.
 */
function monthCells(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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
  initialMonth,
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
  /**
   * The month the calendar opens on. A seasonal appointment card names its
   * month ("November 2027"), so the calendar starts there rather than on
   * today and three clicks of "next" away.
   */
  initialMonth?: Date;
  onCloseAction: () => void;
}) {
  // With one branch — or none, in which case the atelier fallback stands in
  // — there is nothing to choose, so the location step is skipped.
  const branchOptions = branches.length === 0 ? [ATELIER_FALLBACK] : branches;
  const singleBranch = branchOptions.length === 1;
  const [step, setStep] = useState<Step>(
    initialReason ? (singleBranch ? "date" : "location") : "reason",
  );
  const [reason, setReason] = useState<AppointmentReason | null>(
    initialReason ?? null,
  );
  const [branchId, setBranchId] = useState<string | null>(
    singleBranch ? branchOptions[0]!.id : null,
  );
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [month, setMonth] = useState<Date>(() =>
    startOfMonth(
      initialMonth && initialMonth.getTime() > today.getTime()
        ? initialMonth
        : today,
    ),
  );
  const [state, formAction, isPending] = useActionState(
    bookAppointment,
    initialState,
  );

  const branch = branchOptions.find((b) => b.id === branchId) ?? null;
  const cells = useMemo(() => monthCells(month), [month]);
  const canGoBack = month.getTime() > startOfMonth(today).getTime();
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
      <div className="pe-booking-wizard flex flex-col gap-3 rounded-[28px] bg-[#202527] p-8 text-white">
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
    <div className="pe-booking-wizard flex flex-col gap-5 rounded-[28px] bg-[#202527] p-8 text-white">
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
                setStep(singleBranch ? "date" : "location");
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
        <div className="pe-cal">
          <div className="pe-cal-head">
            <button
              type="button"
              className="pe-cal-nav"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
            >
              ‹
            </button>
            <span className="pe-cal-month" aria-live="polite">
              {MONTH_FORMATTER.format(month)}
            </span>
            <button
              type="button"
              className="pe-cal-nav"
              aria-label="Next month"
              onClick={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
            >
              ›
            </button>
          </div>
          <div className="pe-cal-grid" role="grid">
            {WEEKDAY_HEADS.map((head, index) => (
              <span key={index} className="pe-cal-weekday" aria-hidden="true">
                {head}
              </span>
            ))}
            {cells.map((candidate, index) => {
              if (!candidate) return <span key={`pad-${index}`} />;
              const past = candidate.getTime() <= today.getTime();
              const hasHours = timesForDay(branch, candidate).length > 0;
              const selected =
                date !== null && date.getTime() === candidate.getTime();
              return (
                <button
                  key={candidate.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={DATE_FORMATTER.format(candidate)}
                  disabled={past || !hasHours}
                  onClick={() => {
                    setDate(candidate);
                    setStep("time");
                  }}
                  className={[
                    "pe-cal-day",
                    selected ? "is-selected" : "",
                    candidate.getTime() === today.getTime() ? "is-today" : "",
                  ].join(" ")}
                >
                  {candidate.getDate()}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep(singleBranch ? "reason" : "location")}
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
          {branch.id ? (
            <input type="hidden" name="branchId" value={branch.id} />
          ) : null}
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
