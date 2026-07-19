"use server";

import { requireRetailerRole } from "@paon/auth";
import { AppointmentRepository } from "@paon/database";
import { asId, createAppointmentInputSchema } from "@paon/domain";
import { redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface CreateAppointmentFormState {
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  formError?: string;
}

/**
 * `datetime-local` inputs submit a value with no timezone offset
 * ("2026-08-01T14:00") — interpreted as UTC here, matching the same
 * deliberate simplification `computeAvailableSlots` (@paon/domain)
 * documents; per-retailer timezone handling is a real future need, not
 * built yet.
 */
function toIsoUtc(datetimeLocalValue: string): string | null {
  const date = new Date(`${datetimeLocalValue}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function createAppointment(
  _prevState: CreateAppointmentFormState,
  formData: FormData,
): Promise<CreateAppointmentFormState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const startsAt = toIsoUtc(raw["startsAt"] ?? "");
  const endsAt = toIsoUtc(raw["endsAt"] ?? "");

  const parsed = createAppointmentInputSchema.safeParse({
    customerId: raw["customerId"],
    type: raw["type"],
    startsAt: startsAt ?? raw["startsAt"],
    endsAt: endsAt ?? raw["endsAt"],
    staffId: raw["staffId"] || undefined,
    notes: raw["notes"] || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      fieldErrors[key] ??= issue.message;
    }
    return { values: raw, fieldErrors };
  }

  if (parsed.data.startsAt >= parsed.data.endsAt) {
    return {
      values: raw,
      fieldErrors: { endsAt: "End time must be after the start time" },
    };
  }

  const supabase = await getSupabaseServerClient();
  const appointment = await new AppointmentRepository(supabase).create({
    retailerId: session.retailerId,
    customerId: asId<"CustomerId">(parsed.data.customerId),
    type: parsed.data.type,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    ...(parsed.data.staffId
      ? { staffId: asId<"StaffId">(parsed.data.staffId) }
      : {}),
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
  });

  redirect(`/appointments/${appointment.id}`);
}
