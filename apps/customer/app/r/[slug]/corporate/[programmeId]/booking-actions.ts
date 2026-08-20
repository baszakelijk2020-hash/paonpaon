"use server";

import {
  computeAvailableSlots,
  type AvailabilityWindow,
  type Appointment,
} from "@paon/domain";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

export interface GetAvailableSlotsResult {
  readonly ok: true;
  readonly slots: string[];
}

export interface GetAvailableSlotsError {
  readonly ok: false;
  readonly error: string;
}

/**
 * Fetch availability context from RPC and compute available slots for a given date.
 * Called from the client to populate the date picker. Returns only computed
 * start times — never raw availability/appointment data.
 */
export async function getAvailableSlots(
  programmeId: string,
  date: string,
  timeZone: string,
): Promise<GetAvailableSlotsResult | GetAvailableSlotsError> {
  const supabase = await getSupabaseServerClient();

  try {
    // Fetch availability context (windows + appointments).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "get_corporate_office_visit_availability_context",
      { p_programme_id: programmeId },
    );

    if (error) throw error;

    const context = data as {
      windows: AvailabilityWindow[];
      appointments: Pick<Appointment, "startsAt" | "endsAt" | "status">[];
    };

    // Compute available slots using the domain function.
    const slots = computeAvailableSlots({
      windows: context.windows,
      existingAppointments: context.appointments,
      date,
      durationMinutes: DEFAULT_APPOINTMENT_DURATION_MINUTES,
      timeZone,
    });

    return { ok: true, slots };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not fetch slots",
    };
  }
}

export interface BookAppointmentResult {
  readonly ok: true;
  readonly appointmentId: string;
}

export interface BookAppointmentError {
  readonly ok: false;
  readonly error: string;
}

/**
 * Submit a booking request through the self-service booking RPC.
 * This creates a real appointment and customer row immediately.
 */
export async function bookAppointment(
  programmeId: string,
  requesterName: string,
  startsAt: string,
  endsAt: string,
  employeeReference?: string,
  contactEmail?: string,
): Promise<BookAppointmentResult | BookAppointmentError> {
  const supabase = await getSupabaseServerClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)(
      "submit_corporate_office_visit_booking",
      {
        p_programme_id: programmeId,
        p_requester_name: requesterName,
        p_employee_reference: employeeReference ?? "",
        p_contact_email: contactEmail ?? "",
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      },
    );

    if (error) throw error;

    return { ok: true, appointmentId: String(data) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Could not book appointment",
    };
  }
}
