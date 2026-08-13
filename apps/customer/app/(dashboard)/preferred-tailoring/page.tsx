import {
  CustomerRepository,
  ServicePartnerRepository,
  WardrobeRepository,
} from "@paon/database";
import Image from "next/image";
import Link from "next/link";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * FT-14 monthly grid — founder-supplied external reference image plus
 * `pag3.html` (no source file committed; see `FOUNDER_TOOL_BLUEPRINTS.md`
 * FT-14). Current-month calendar; a subset of days show a garment photo
 * that fades in with a per-day varied start delay and an ~4s fade,
 * rather than every image appearing at once. This page is the entry
 * point into the existing HighMaintenance care journey at `/services`,
 * not a decorative separate screen — clicking a day with care due links
 * there. Days are driven by `get_my_service_care_status()`, the same
 * customer-safe, auth-derived projection `/services` already uses; no
 * new schema, RPC or invented photo data.
 */

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface DayCareEntry {
  readonly garmentDisplayName: string;
  readonly photoUrl?: string;
}

interface GridDay {
  readonly dateKey: string;
  readonly dayOfMonth: number;
  readonly inCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly care: readonly DayCareEntry[];
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Deterministic per-day fade delay in [0, 2500)ms. Not `Math.random()` —
 * a server-rendered page needs the same delay on every render for a
 * given day, or hydration would flicker/mismatch.
 */
function fadeDelayMs(dateKey: string): number {
  let hash = 0;
  for (const char of dateKey) {
    hash = (hash * 31 + char.charCodeAt(0)) % 2500;
  }
  return hash;
}

function buildMonthGrid(
  monthStart: Date,
  todayKey: string,
  careByDate: ReadonlyMap<string, readonly DayCareEntry[]>,
): GridDay[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // Monday-first grid: ISO weekday 1=Mon..7=Sun, shift to a 0-based offset.
  const leadingBlankDays = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - leadingBlankDays);

  const days: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateKey = toDateKey(date);
    days.push({
      dateKey,
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      isToday: dateKey === todayKey,
      care: careByDate.get(dateKey) ?? [],
    });
  }
  // Drop any trailing week that is entirely outside the current month.
  while (
    days.length > 35 &&
    days.slice(-7).every((day) => !day.inCurrentMonth)
  ) {
    days.splice(-7, 7);
  }
  return days;
}

export default async function PreferredTailoringPage() {
  const session = await requireSession();
  const client = await getSupabaseServerClient();

  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  const [careStatus, wardrobeItemsByCustomer] = await Promise.all([
    new ServicePartnerRepository(client).listMyCustomerCareStatus(),
    Promise.all(
      customers.map((customer) =>
        new WardrobeRepository(client).findByCustomer(customer.id),
      ),
    ),
  ]);

  const photoByGarmentName = new Map<string, string>();
  for (const items of wardrobeItemsByCustomer) {
    for (const item of items) {
      if (
        item.identifyingPhotoUrl &&
        !photoByGarmentName.has(item.displayName)
      ) {
        photoByGarmentName.set(item.displayName, item.identifyingPhotoUrl);
      }
    }
  }

  const careByDate = new Map<string, DayCareEntry[]>();
  for (const care of careStatus) {
    if (care.custodyState === "released_to_customer") continue;
    const photoUrl = photoByGarmentName.get(care.garmentDisplayName);
    const entry: DayCareEntry = {
      garmentDisplayName: care.garmentDisplayName,
      ...(photoUrl ? { photoUrl } : {}),
    };
    const existing = careByDate.get(care.dueOn);
    if (existing) existing.push(entry);
    else careByDate.set(care.dueOn, [entry]);
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayKey = toDateKey(now);
  const days = buildMonthGrid(monthStart, todayKey, careByDate);
  const monthLabel = monthStart.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
          Preferred Tailoring
        </p>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          {monthLabel}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-stone-500)]">
          Days carrying a garment are moving through care. Open{" "}
          <Link href="/services" className="underline">
            Services
          </Link>{" "}
          for the full journey.
        </p>
      </div>

      <div
        className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-[var(--color-stone-200)]"
        role="grid"
        aria-label={`${monthLabel} calendar`}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="bg-[var(--color-stone-50)] px-2 py-2 text-center text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-stone-500)]"
          >
            {label}
          </div>
        ))}

        {days.map((day) => {
          const hasCare = day.care.length > 0;
          const primary = day.care[0];
          const cellContent = (
            <>
              <span
                className={`text-sm ${
                  day.isToday
                    ? "font-semibold text-[var(--color-stone-900)]"
                    : day.inCurrentMonth
                      ? "text-[var(--color-stone-700)]"
                      : "text-[var(--color-stone-300)]"
                }`}
              >
                {day.dayOfMonth}
              </span>
              {hasCare && primary ? (
                <span
                  className="preferred-tailoring-photo-fade absolute inset-0 flex items-end overflow-hidden"
                  style={{
                    ["--pt-fade-delay" as string]: `${fadeDelayMs(day.dateKey)}ms`,
                  }}
                  aria-hidden="true"
                >
                  {primary.photoUrl ? (
                    <Image
                      src={primary.photoUrl}
                      alt=""
                      fill
                      unoptimized
                      className="object-cover opacity-80"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#2b2b27_0%,#5c5346_60%,#a3927e_100%)]">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6 text-white/70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M8 3l4 2 4-2 3 4-3 2v12H5V9L2 7l3-4 3 2z" />
                      </svg>
                    </span>
                  )}
                </span>
              ) : null}
            </>
          );

          return (
            <div
              key={day.dateKey}
              role="gridcell"
              aria-label={
                hasCare && primary
                  ? `${day.dateKey}: ${primary.garmentDisplayName} in care`
                  : day.dateKey
              }
              className={`relative flex aspect-square flex-col justify-start gap-1 bg-white p-2 ${
                day.inCurrentMonth ? "" : "bg-[var(--color-stone-50)]"
              }`}
            >
              {hasCare ? (
                <Link
                  href="/services"
                  className="absolute inset-0"
                  aria-label={`Open Services for ${primary?.garmentDisplayName ?? "care"} due ${day.dateKey}`}
                />
              ) : null}
              <div className="relative z-10 flex flex-1 flex-col">
                {cellContent}
              </div>
            </div>
          );
        })}
      </div>

      {careStatus.length === 0 ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          No care is scheduled this month. Your house advisor arranges Preferred
          Tailoring and HighMaintenance visits.
        </p>
      ) : null}
    </div>
  );
}
