import type {
  AppointmentId,
  AvailabilityWindowId,
  CustomerId,
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
 * Generates bookable start times for `date` from a staff member's
 * recurring `AvailabilityWindow`s, in `durationMinutes` increments,
 * excluding any time that overlaps an existing (non-canceled)
 * `Appointment`. Pure — no I/O, no knowledge of how windows/appointments
 * were fetched, so it works the same in a Server Component (Retailer
 * Portal calendar) and in the public storefront booking page.
 *
 * `date`/`startTime`/`endTime` are interpreted as UTC explicitly (via
 * `Date.UTC`, never the platform-default `new Date("...")` string
 * parse, which resolves an offset-less date-time as *local* time and
 * would silently shift every slot by the server's timezone). Per-
 * retailer timezone handling is a real future need, not built here —
 * `docs/PROJECT_STATE.md` tracks it as a deliberate gap, not a silent
 * one.
 */
export function computeAvailableSlots(params: {
  windows: readonly AvailabilityWindow[];
  existingAppointments: readonly Pick<
    Appointment,
    "startsAt" | "endsAt" | "status"
  >[];
  date: string;
  durationMinutes: number;
}): string[] {
  const { windows, existingAppointments, date, durationMinutes } = params;
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
    let cursor = Date.UTC(year, month - 1, day, start.hour, start.minute);
    const windowEnd = Date.UTC(year, month - 1, day, end.hour, end.minute);

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
