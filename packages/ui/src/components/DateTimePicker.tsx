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

export function DateTimePicker({
  name,
  defaultValue,
}: {
  name: string;
  /** `YYYY-MM-DDTHH:MM`, re-populating the selection after a failed submit —
   * the same round-trip a native `datetime-local` input gets for free. */
  defaultValue?: string | undefined;
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

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" id={name} name={name} value={value} required />
      <div
        className="-mx-5 flex gap-[10px] overflow-x-auto px-5 pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {days.map((day) => {
          const selected = day.iso === selectedDate;
          return (
            <button
              key={day.iso}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedDate(day.iso)}
              className="flex h-[54px] w-14 flex-none flex-col items-center justify-center gap-1 rounded-[8px] bg-white transition-opacity duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)]"
              style={{ opacity: selected ? 1 : 0.55 }}
            >
              <span className="text-[9px] uppercase text-[var(--color-stone-500)]">
                {day.weekday}
              </span>
              <span className="text-[20px] text-[var(--color-stone-800)]">
                {day.day}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {slots.map((slot) => {
          const selected = slot === selectedTime;
          return (
            <button
              key={slot}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedTime(slot)}
              className="h-[38px] min-w-[76px] flex-none rounded-[6px] bg-white text-sm text-[var(--color-stone-800)] transition-opacity duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)]"
              style={{ opacity: selected ? 1 : 0.55 }}
            >
              {slot}
            </button>
          );
        })}
      </div>
    </div>
  );
}
