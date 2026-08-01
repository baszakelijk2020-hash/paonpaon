"use client";

import { useMemo, useState } from "react";

/**
 * paon.html's own date/time picker (`#paon-mobile-appointment`) — a
 * horizontally scrolling day strip plus a time-slot row, selection shown by
 * opacity, not a calendar grid or native date picker. Ported behaviour from
 * that file's `buildAppointmentPicker()`: next 7 weekdays (Sat/Sun
 * skipped), half-hour slots 09:00-18:00. Produces the same
 * `YYYY-MM-DDTHH:MM` value a native `datetime-local` input would, so
 * consuming Server Actions (`requestAppointment`, `createAppointment`)
 * need no changes. Shared by both apps/customer's booking request form and
 * apps/retailer's staff booking form — do not duplicate a per-app copy.
 */

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface Day {
  iso: string;
  weekday: string;
  day: number;
}

function nextBusinessDays(count: number): Day[] {
  const days: Day[] = [];
  const cursor = new Date();
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) continue;
    days.push({
      iso: cursor.toISOString().slice(0, 10),
      weekday: WEEKDAYS[dow]!,
      day: cursor.getDate(),
    });
  }
  return days;
}

function timeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (const min of [":00", ":30"]) {
      if (h === 18 && min === ":30") continue;
      slots.push(`${h < 10 ? "0" : ""}${h}${min}`);
    }
  }
  return slots;
}

/** "Thursday 7 August at 14:30" — the choice, said back in words. */
function spellOut(date: string, time: string): string {
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) return "";
  const day = parsed.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${day} at ${time}`;
}

export function DateTimePicker({
  name,
  defaultValue,
  label,
}: {
  name: string;
  /** `YYYY-MM-DDTHH:MM`, re-populating the selection after a failed submit —
   * the same round-trip a native `datetime-local` input gets for free. */
  defaultValue?: string | undefined;
  /**
   * The field's own label, e.g. "Starts". Each strip needs its own accessible
   * name: two unnamed rows of buttons on one page are indistinguishable to
   * anyone not looking at them.
   */
  label?: string | undefined;
}) {
  const days = useMemo(() => nextBusinessDays(7), []);
  const slots = useMemo(() => timeSlots(), []);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    defaultValue?.slice(0, 10) || null,
  );
  const [selectedTime, setSelectedTime] = useState<string | null>(
    defaultValue?.slice(11, 16) || null,
  );

  const value =
    selectedDate && selectedTime ? `${selectedDate}T${selectedTime}` : "";

  const chosen = value ? spellOut(selectedDate!, selectedTime!) : "";
  const named = label ?? "Date and time";

  return (
    <div
      className="flex flex-col gap-3"
      role="group"
      aria-labelledby={`${name}-label`}
      data-datetime-field={name}
      data-datetime-value={value}
    >
      {/* The value the form actually submits. It carries no id: a <label for>
          pointing at a hidden input names a control nobody can reach, and
          leaves these buttons anonymous. The group above is named instead. */}
      <input type="hidden" name={name} value={value} />

      <div
        role="radiogroup"
        aria-label={`${named} — day`}
        className="-mx-5 flex gap-[10px] overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {days.map((day) => {
          const selected = day.iso === selectedDate;
          return (
            <button
              key={day.iso}
              type="button"
              role="radio"
              aria-checked={selected}
              // A date needs its full name for anyone who cannot see the
              // column header: "MON 4" alone is not a date.
              aria-label={new Date(`${day.iso}T00:00`).toLocaleDateString(
                "en-GB",
                { weekday: "long", day: "numeric", month: "long" },
              )}
              data-day={day.iso}
              onClick={() => setSelectedDate(day.iso)}
              // Selection is a border and a fill, not opacity alone.
              // Opacity-only state is invisible to anyone who cannot compare
              // two swatches side by side, and dimmed text fails contrast.
              className={`flex h-[54px] w-14 flex-none flex-col items-center justify-center gap-1 rounded-[8px] border transition-[background-color,border-color] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-stone-900)] ${
                selected
                  ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)]"
                  : "border-[var(--color-stone-200)] bg-white hover:bg-[var(--color-stone-50)]"
              }`}
            >
              <span
                className={`text-[9px] uppercase ${
                  selected ? "text-[#f0efec]" : "text-[var(--color-stone-500)]"
                }`}
              >
                {day.weekday}
              </span>
              <span
                className={`text-[20px] ${
                  selected ? "text-[#f0efec]" : "text-[var(--color-stone-800)]"
                }`}
              >
                {day.day}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label={`${named} — time`}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {slots.map((slot) => {
          const selected = slot === selectedTime;
          return (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={selected}
              data-time={slot}
              onClick={() => setSelectedTime(slot)}
              className={`h-[38px] min-w-[76px] flex-none rounded-[6px] border text-sm transition-[background-color,border-color] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-stone-900)] ${
                selected
                  ? "border-[var(--color-stone-900)] bg-[var(--color-stone-900)] text-[#f0efec]"
                  : "border-[var(--color-stone-200)] bg-white text-[var(--color-stone-800)] hover:bg-[var(--color-stone-50)]"
              }`}
            >
              {slot}
            </button>
          );
        })}
      </div>

      {/* The choice read back in words. UX_PHILOSOPHY rule 1: legible without
          having to compare two highlighted cells to work out what is set. */}
      <p
        role="status"
        data-datetime-summary={name}
        className="text-sm text-[var(--color-stone-600)]"
      >
        {chosen ? chosen : "Choose a day and a time."}
      </p>
    </div>
  );
}
