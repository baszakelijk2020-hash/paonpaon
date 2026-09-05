import type { ServiceBooking } from "@paon/domain";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(isoDate: string): string {
  return isoDate.slice(0, 10);
}

interface DayCell {
  readonly dateKey: string;
  readonly dayOfMonth: number;
  readonly inCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly hasScheduledCare: boolean;
}

/** A day's fade start delay is derived from its own date key, not a fresh
 * random draw on every render — same day always fades at the same moment,
 * still visibly staggered across the grid. */
function fadeDelaySeconds(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return (hash % 20) / 10; // 0.0s .. 1.9s
}

function buildMonthGrid(
  referenceDate: Date,
  bookedDateKeys: Set<string>,
): {
  readonly monthLabel: string;
  readonly weeks: readonly DayCell[][];
} {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  // Local-timezone key, matching how every grid day's own key is built below
  // — comparing against toISOString()'s UTC date would misidentify "today"
  // for any timezone west of UTC in the evening.
  const todayKey = `${referenceDate.getFullYear()}-${String(referenceDate.getMonth() + 1).padStart(2, "0")}-${String(referenceDate.getDate()).padStart(2, "0")}`;

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const days: DayCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({
      dateKey,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
      hasScheduledCare: bookedDateKeys.has(dateKey),
    });
  }

  const weeks: DayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return {
    monthLabel: firstOfMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    weeks,
  };
}

/** The customer-facing entry surface into Preferred Tailoring's weekly/
 * agenda orchestration (FOUNDER_TOOL_BLUEPRINTS.md FT-14) — a current-month
 * calendar where days with real scheduled care (a ServiceBooking.requestedFor
 * falling on that date) fade in a garment image, each on its own staggered
 * delay rather than all at once. Days are derived from the customer's real
 * bookings, never a decorative random subset. */
export function PreferredTailoringMonthGrid({
  bookings,
  now,
}: {
  readonly bookings: readonly ServiceBooking[];
  readonly now: Date;
}) {
  const bookedDateKeys = new Set(
    bookings
      .filter((booking) => booking.requestedFor)
      .map((booking) => toDateKey(booking.requestedFor!)),
  );
  const { monthLabel, weeks } = buildMonthGrid(now, bookedDateKeys);

  return (
    <section
      className="customer-panel w-full p-5 sm:p-6"
      aria-labelledby="preferred-tailoring-month"
    >
      <p className="customer-kicker">Preferred Tailoring</p>
      <p
        id="preferred-tailoring-month"
        className="font-display mb-5 text-2xl text-[var(--customer-ink)]"
      >
        {monthLabel}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-[0.12em] text-[var(--color-stone-500)]">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {weeks.flat().map((day) => {
          const cellClassName = `relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-[var(--radius-sm)] text-xs ${
            day.inCurrentMonth
              ? "text-[var(--customer-ink)]"
              : "text-[var(--color-stone-400)]"
          } ${
            day.isToday
              ? "bg-[var(--customer-moss)] ring-1 ring-[var(--customer-ink)] ring-offset-1"
              : "bg-black/[0.025]"
          }`;
          const cellContent = (
            <>
              {day.hasScheduledCare ? (
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full text-[var(--color-stone-900)]"
                  style={{
                    opacity: 0,
                    animation: `paon-tailoring-fade-in 4s ease-out ${fadeDelaySeconds(day.dateKey)}s forwards`,
                  }}
                >
                  <path
                    fill="currentColor"
                    fillOpacity="0.16"
                    d="M8 2 5 4v3l2 1-1 12h12L17 8l2-1V4l-3-2-4 2z"
                  />
                </svg>
              ) : null}
              <span className="relative z-10">{day.dayOfMonth}</span>
            </>
          );
          // Only bookable days are real links (into the care journey below);
          // an <a> with no href is not a valid destination and shouldn't be
          // announced as one.
          return day.hasScheduledCare ? (
            <a key={day.dateKey} href="#care-journey" className={cellClassName}>
              {cellContent}
            </a>
          ) : (
            <div key={day.dateKey} className={cellClassName}>
              {cellContent}
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes paon-tailoring-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </section>
  );
}
