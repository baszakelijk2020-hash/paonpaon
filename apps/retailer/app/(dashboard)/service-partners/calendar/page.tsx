import {
  AppointmentRepository,
  CustomerRepository,
  ServicePartnerRepository,
  ServicePlanRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  SERVICE_BOOKING_KIND_LABELS,
  SERVICE_BOOKING_STATUS_LABELS,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const DAY_MS = 86_400_000;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfWeek(value: Date): Date {
  const start = new Date(`${dateOnly(value)}T00:00:00.000Z`);
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
}

function parseWeekStart(value?: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return startOfWeek(new Date());
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? startOfWeek(new Date())
    : startOfWeek(parsed);
}

function withinWeek(date: string | undefined, start: Date, end: Date): boolean {
  if (!date) return false;
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed >= start && parsed < end;
}

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function ServicePartnerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await requireModuleSession(
    "garment_service_operations",
    "read",
  );
  const { week } = await searchParams;
  const weekStart = parseWeekStart(week);
  const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
  const days = Array.from(
    { length: 7 },
    (_, index) => new Date(weekStart.getTime() + index * DAY_MS),
  );
  const supabase = await getSupabaseServerClient();
  const servicePlans = new ServicePlanRepository(supabase);
  const partnerRepo = new ServicePartnerRepository(supabase);
  const wardrobeRepo = new WardrobeRepository(supabase);

  const [bookings, appointments, engagements, customers, partners] =
    await Promise.all([
      servicePlans.listBookingsByRetailer(session.retailerId),
      new AppointmentRepository(supabase).findByRetailer(session.retailerId),
      partnerRepo.findEngagementsByRetailer(session.retailerId),
      new CustomerRepository(supabase).findByRetailer(session.retailerId),
      partnerRepo.findPartnersByRetailer(session.retailerId),
    ]);

  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.fullName]),
  );
  const appointmentById = new Map(
    appointments.map((appointment) => [appointment.id, appointment]),
  );
  const partnerById = new Map(
    partners.map((partner) => [partner.id, partner.displayName]),
  );
  const wardrobeItemIds = [
    ...new Set(
      engagements
        .map((engagement) => engagement.wardrobeItemId)
        .filter((id) => id.length > 0),
    ),
  ];
  const wardrobeItems = await Promise.all(
    wardrobeItemIds.map(
      async (id) => [id, await wardrobeRepo.findById(id)] as const,
    ),
  );
  const garmentById = new Map(
    wardrobeItems.flatMap(([id, item]) =>
      item ? [[id, item.displayName] as const] : [],
    ),
  );

  const previousWeek = dateOnly(new Date(weekStart.getTime() - 7 * DAY_MS));
  const nextWeek = dateOnly(weekEnd);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Weekly service calendar
          </h1>
          <p className="text-sm text-[var(--color-stone-500)]">
            Preferred Tailoring operational view for bookings, appointments, and
            open partner custody.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link
            href={`/service-partners/calendar?week=${previousWeek}`}
            className="underline underline-offset-4"
          >
            Previous week
          </Link>
          <Link
            href="/service-partners/calendar"
            className="underline underline-offset-4"
          >
            This week
          </Link>
          <Link
            href={`/service-partners/calendar?week=${nextWeek}`}
            className="underline underline-offset-4"
          >
            Next week
          </Link>
        </div>
      </div>

      <div
        className="grid gap-3 lg:grid-cols-7"
        data-testid="service-week-calendar"
      >
        {days.map((day) => {
          const dayKey = dateOnly(day);
          const dayBookings = bookings.filter(
            (booking) =>
              withinWeek(booking.requestedFor, weekStart, weekEnd) &&
              booking.requestedFor?.slice(0, 10) === dayKey,
          );
          const dayAppointments = appointments.filter(
            (appointment) =>
              withinWeek(appointment.startsAt, weekStart, weekEnd) &&
              appointment.startsAt.slice(0, 10) === dayKey,
          );
          const dayEngagements = engagements.filter(
            (engagement) =>
              engagement.custodyState !== "released_to_customer" &&
              engagement.dueOn === dayKey,
          );

          return (
            <Card key={dayKey} className="min-h-48 p-3">
              <h2 className="border-b border-[var(--color-stone-200)] pb-2 text-sm font-medium text-[var(--color-stone-900)]">
                {dateLabel(day)}
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {dayBookings.map((booking) => {
                  const linkedAppointment = booking.appointmentId
                    ? appointmentById.get(booking.appointmentId)
                    : undefined;
                  return (
                    <li key={`booking-${booking.id}`} className="text-xs">
                      <Badge tone="neutral">Booking</Badge>
                      <p className="mt-1 font-medium text-[var(--color-stone-900)]">
                        {customerNameById.get(booking.customerId) ?? "Client"} ·{" "}
                        {SERVICE_BOOKING_KIND_LABELS[booking.kind]}
                      </p>
                      <p className="text-[var(--color-stone-500)]">
                        {SERVICE_BOOKING_STATUS_LABELS[booking.status]}
                      </p>
                      {linkedAppointment ? (
                        <Link
                          href={`/appointments/${linkedAppointment.id}`}
                          className="mt-1 inline-block underline underline-offset-2"
                        >
                          Appointment · {timeLabel(linkedAppointment.startsAt)}
                        </Link>
                      ) : null}
                    </li>
                  );
                })}
                {dayAppointments.map((appointment) => (
                  <li key={`appointment-${appointment.id}`} className="text-xs">
                    <Badge tone="success">Appointment</Badge>
                    <Link
                      href={`/appointments/${appointment.id}`}
                      className="mt-1 block font-medium text-[var(--color-stone-900)] underline underline-offset-2"
                    >
                      {timeLabel(appointment.startsAt)} ·{" "}
                      {customerNameById.get(appointment.customerId) ?? "Client"}
                    </Link>
                    <p className="text-[var(--color-stone-500)]">
                      {appointment.type.replaceAll("_", " ")} ·{" "}
                      {appointment.status}
                    </p>
                  </li>
                ))}
                {dayEngagements.map((engagement) => (
                  <li key={`engagement-${engagement.id}`} className="text-xs">
                    <Badge tone="warning">Due</Badge>
                    <p className="mt-1 font-medium text-[var(--color-stone-900)]">
                      {customerNameById.get(engagement.customerId) ?? "Client"}{" "}
                      ·{" "}
                      {garmentById.get(engagement.wardrobeItemId) ?? "Garment"}
                    </p>
                    <p className="text-[var(--color-stone-500)]">
                      {partnerById.get(engagement.partnerId) ?? "Partner"} ·{" "}
                      {engagement.custodyState.replaceAll("_", " ")}
                    </p>
                  </li>
                ))}
                {dayBookings.length +
                  dayAppointments.length +
                  dayEngagements.length ===
                0 ? (
                  <li className="text-xs text-[var(--color-stone-400)]">
                    No service commitments.
                  </li>
                ) : null}
              </ul>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
