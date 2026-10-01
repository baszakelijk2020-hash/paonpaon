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

export async function quickUpdateAppointmentStatus(
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const parsed = updateAppointmentInputSchema.safeParse({ status });
  if (!appointmentId || !parsed.success || !parsed.data.status) return;

  const repository = new AppointmentRepository(await getSupabaseServerClient());
  await repository.update(asId<"AppointmentId">(appointmentId), {
    status: parsed.data.status,
  });
  // Same rule as the detail page: the customer hears about a status change.
  await notifyStatusChange(repository, appointmentId, parsed.data.status);
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

/** Bulk row-select completion — a floor advisor clearing a full day of
 * fittings one at a time was the friction; this is the same single-row
 * `update` the quick-status form already uses, just fanned out. */
export async function bulkCompleteAppointments(
  formData: FormData,
): Promise<void> {
  const session = await requireModuleSession("relationship_intelligence");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const appointmentIds = formData
    .getAll("appointmentIds")
    .map(String)
    .filter(Boolean);
  if (appointmentIds.length === 0) return;

  const repository = new AppointmentRepository(await getSupabaseServerClient());
  await Promise.all(
    appointmentIds.map(async (id) => {
      await repository.update(asId<"AppointmentId">(id), {
        status: "completed",
      });
      await notifyStatusChange(repository, id, "completed");
    }),
  );
  revalidatePath("/appointments");
}

/**
 * Tell the customer their appointment's status moved. Deliberately swallows
 * its own failures: the status change is already saved and is the thing that
 * matters — a notification that could not be written must never make a
 * completed appointment look like it failed.
 */
async function notifyStatusChange(
  repository: AppointmentRepository,
  appointmentId: string,
  status: NonNullable<
    ReturnType<typeof updateAppointmentInputSchema.parse>["status"]
  >,
): Promise<void> {
  try {
    const label = APPOINTMENT_STATUS_LABELS[status];
    await repository.notifyCustomerOfChange({
      appointmentId: asId<"AppointmentId">(appointmentId),
      title:
        status === "canceled"
          ? "Your appointment was cancelled"
          : `Your appointment is now ${label.toLowerCase()}`,
      body: "Open your appointment for the details.",
    });
  } catch {
    // Intentionally ignored — see the docstring above.
  }
}
