import "server-only";

import type { AppointmentRepository } from "@paon/database";
import type {
  CalendarDayQuery,
  CalendarDayResult,
  CalendarOccasion,
  CalendarProvider,
} from "@paon/domain";

/**
 * Projects upcoming appointments into MorningRoutine occasion context.
 * No external calendar SDK — provider-neutral. Throws on repository failure
 * so callers can mark calendarStatus as skipped_failed.
 */
export class AppointmentCalendarProvider implements CalendarProvider {
  constructor(private readonly appointments: AppointmentRepository) {}

  async listOccasionsForDay(
    query: CalendarDayQuery,
  ): Promise<CalendarDayResult> {
    const rows = await this.appointments.findByCustomer(
      query.customerId as never,
    );
    const dayStart = `${query.day}T00:00:00.000Z`;
    const dayEnd = `${query.day}T23:59:59.999Z`;
    const occasions: CalendarOccasion[] = rows
      .filter(
        (appointment) =>
          appointment.retailerId === query.retailerId &&
          appointment.status !== "canceled" &&
          appointment.startsAt >= dayStart &&
          appointment.startsAt <= dayEnd,
      )
      .map((appointment) => ({
        label: appointment.notes?.trim()
          ? appointment.notes.trim()
          : `${appointment.type.replaceAll("_", " ")} appointment`,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        source: "appointment" as const,
        appointmentId: appointment.id,
      }));
    return { status: "live", occasions };
  }
}
