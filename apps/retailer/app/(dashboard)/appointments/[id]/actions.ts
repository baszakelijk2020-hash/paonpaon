"use server";

import { requireRetailerRole } from "@paon/auth";
import { AppointmentRepository } from "@paon/database";
import {
  APPOINTMENT_STATUS_LABELS,
  asId,
  updateAppointmentInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface UpdateAppointmentFormState {
  formError?: string;
}

export async function updateAppointment(
  appointmentId: string,
  _prevState: UpdateAppointmentFormState,
  formData: FormData,
): Promise<UpdateAppointmentFormState> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const parsed = updateAppointmentInputSchema.safeParse({
    status: raw["status"] || undefined,
    staffId: raw["staffId"] || undefined,
  });

  if (!parsed.success) {
    return { formError: "Choose a valid status and advisor." };
  }

  const supabase = await getSupabaseServerClient();
  const repo = new AppointmentRepository(supabase);

  try {
    await repo.update(asId<"AppointmentId">(appointmentId), {
      ...(parsed.data.status !== undefined
        ? { status: parsed.data.status }
        : {}),
      ...(parsed.data.staffId !== undefined
        ? { staffId: asId<"StaffId">(parsed.data.staffId) }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  // A status change is the customer's business: they are the one waiting to
  // hear whether the time stands. Reassigning an advisor internally is not, so
  // only the status triggers this.
  if (parsed.data.status !== undefined) {
    const label = APPOINTMENT_STATUS_LABELS[parsed.data.status];
    try {
      await repo.notifyCustomerOfChange({
        appointmentId: asId<"AppointmentId">(appointmentId),
        title:
          parsed.data.status === "canceled"
            ? "Your appointment was cancelled"
            : `Your appointment is now ${label.toLowerCase()}`,
        body: "Open your appointment for the details.",
      });
    } catch {
      // The change itself is already saved and is the thing that matters; a
      // failed notification must not report the update as failed.
    }
  }

  revalidatePath(`/appointments/${appointmentId}`);
  return {};
}
