"use server";

import { AppointmentRepository } from "@paon/database";
import { asId } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/**
 * Cancelling and moving an appointment from the customer's own side.
 *
 * Both go through SECURITY DEFINER RPCs rather than a table write: a customer
 * holds SELECT-only RLS on `appointments`, and the RPCs re-derive ownership
 * from `auth.uid()` rather than trusting the id in the form. A reschedule is
 * checked against the same closure/capacity rule the booking path uses, so a
 * slot cannot be validated one way on the way in and another on the way across.
 *
 * Failures come back as `formError` for the caller to render inline — the
 * interesting ones ("That time has just been taken") are ordinary races, not
 * exceptional conditions, and must never reach an error boundary.
 */
export interface AppointmentManageState {
  formError?: string;
  ok?: boolean;
}

function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  // Postgres prefixes RAISE messages; the RPCs already phrase these for a
  // customer to read, so pass them through rather than inventing a generic one.
  const cleaned = raw.replace(/^.*?:\s*/, "").trim();
  return cleaned.length > 0 && cleaned.length <= 200
    ? cleaned
    : "That could not be changed just now. Please try again.";
}

export async function cancelMyAppointment(
  _prevState: AppointmentManageState,
  formData: FormData,
): Promise<AppointmentManageState> {
  await requireSession();

  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return { formError: "Appointment not found." };
  const reason = String(formData.get("reason") ?? "").trim();

  try {
    await new AppointmentRepository(
      await getSupabaseServerClient(),
    ).cancelMyAppointment({
      appointmentId: asId<"AppointmentId">(appointmentId),
      ...(reason ? { reason } : {}),
    });
  } catch (error) {
    return { formError: messageFor(error) };
  }

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
  return { ok: true };
}

export async function rescheduleMyAppointment(
  _prevState: AppointmentManageState,
  formData: FormData,
): Promise<AppointmentManageState> {
  await requireSession();

  const appointmentId = String(formData.get("appointmentId") ?? "");
  const startsAt = String(formData.get("startsAt") ?? "");
  const endsAt = String(formData.get("endsAt") ?? "");
  if (!appointmentId) return { formError: "Appointment not found." };
  if (!startsAt || !endsAt) return { formError: "Choose a new time." };

  const start = Date.parse(startsAt);
  const end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return { formError: "Choose a new time." };
  }
  if (start < Date.now()) {
    return { formError: "Choose a time in the future." };
  }

  try {
    await new AppointmentRepository(
      await getSupabaseServerClient(),
    ).rescheduleMyAppointment({
      appointmentId: asId<"AppointmentId">(appointmentId),
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
  } catch (error) {
    return { formError: messageFor(error) };
  }

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
  return { ok: true };
}
