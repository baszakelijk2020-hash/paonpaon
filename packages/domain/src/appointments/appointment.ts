import type {
  AppointmentId,
  AvailabilityWindowId,
  CustomerId,
  RetailerBranchId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

export type AppointmentType =
  | "styling_consultation"
  | "fitting"
  | "alteration_fitting"
  | "personal_shopping"
  | "event";

export type AppointmentStatus =
  | "requested"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "canceled"
  | "no_show";

export interface Appointment extends Timestamps {
  readonly id: AppointmentId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly staffId?: StaffId;
  readonly branchId?: RetailerBranchId;
  readonly type: AppointmentType;
  readonly status: AppointmentStatus;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly locationId?: string;
  readonly notes?: string;
}

/**
 * A staff member's bookable windows, consumed when generating appointment
 * slots (see `computeAvailableSlots` below). `id` exists purely for CRUD
 * addressability (edit/delete one window) — the window itself has no
 * business identity beyond `staffId` + `dayOfWeek` + the time range.
 */
export interface AvailabilityWindow {
  readonly id: AvailabilityWindowId;
  readonly staffId: StaffId;
  readonly retailerId: RetailerId;
  readonly dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly startTime: string;
  readonly endTime: string;
}

function parseDateOnly(date: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = date.split("-").map(Number);
  return { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
}

function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":").map(Number);
  return { hour: hour ?? 0, minute: minute ?? 0 };
}

/**
 * Convert a calendar date + HH:MM wall clock in `timeZone` to UTC ISO.
 * Uses Intl offset iteration so DST transitions stay honest.
 */
export function wallTimeInZoneToUtcIso(
  date: string,
  time: string,
  timeZone: string,
): string {
  const { year, month, day } = parseDateOnly(date);
  const { hour, minute } = parseTimeOfDay(time);
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    const diff = desired - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess).toISOString();
}

/**
 * Generates bookable start times for `date` from a staff member's
 * recurring `AvailabilityWindow`s, in `durationMinutes` increments,
 * excluding any time that overlaps an existing (non-canceled)
 * `Appointment`. Pure — no I/O.
 *
 * Without `timeZone`, window walls are interpreted as UTC (legacy
 * behaviour). With `timeZone`, walls are interpreted in that IANA zone
 * and emitted as UTC ISO strings.
 */
export function computeAvailableSlots(params: {
  windows: readonly AvailabilityWindow[];
  existingAppointments: readonly Pick<
    Appointment,
    "startsAt" | "endsAt" | "status"
  >[];
  date: string;
  durationMinutes: number;
  timeZone?: string;
}): string[] {
  const { windows, existingAppointments, date, durationMinutes, timeZone } =
    params;
  const { year, month, day } = parseDateOnly(date);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay() as
    0 | 1 | 2 | 3 | 4 | 5 | 6;

  const busyRanges = existingAppointments
    .filter((appointment) => appointment.status !== "canceled")
    .map((appointment) => ({
      start: new Date(appointment.startsAt).getTime(),
      end: new Date(appointment.endsAt).getTime(),
    }));

  const slots: string[] = [];
  const stepMs = durationMinutes * 60_000;

  for (const window of windows) {
    if (window.dayOfWeek !== dayOfWeek) {
      continue;
    }

    const start = parseTimeOfDay(window.startTime);
    const end = parseTimeOfDay(window.endTime);
    let cursor = timeZone
      ? Date.parse(
          wallTimeInZoneToUtcIso(
            date,
            `${String(start.hour).padStart(2, "0")}:${String(start.minute).padStart(2, "0")}`,
            timeZone,
          ),
        )
      : Date.UTC(year, month - 1, day, start.hour, start.minute);
    const windowEnd = timeZone
      ? Date.parse(
          wallTimeInZoneToUtcIso(
            date,
            `${String(end.hour).padStart(2, "0")}:${String(end.minute).padStart(2, "0")}`,
            timeZone,
          ),
        )
      : Date.UTC(year, month - 1, day, end.hour, end.minute);

    while (cursor + stepMs <= windowEnd) {
      const slotStart = cursor;
      const slotEnd = cursor + stepMs;
      const overlaps = busyRanges.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start,
      );
      if (!overlaps) {
        slots.push(new Date(slotStart).toISOString());
      }
      cursor += stepMs;
    }
  }

  return slots.sort();
}
