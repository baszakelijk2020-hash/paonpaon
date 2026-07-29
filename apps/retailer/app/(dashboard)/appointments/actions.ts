"use server";

import { requireRetailerRole } from "@paon/auth";
import { AppointmentRepository } from "@paon/database";
import { asId, updateAppointmentInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function quickUpdateAppointmentStatus(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const status = String(formData.get("status") ?? "");
  const parsed = updateAppointmentInputSchema.safeParse({ status });
  if (!appointmentId || !parsed.success || !parsed.data.status) return;

  await new AppointmentRepository(await getSupabaseServerClient()).update(
    asId<"AppointmentId">(appointmentId),
    { status: parsed.data.status },
  );
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

/** Bulk row-select completion — a floor advisor clearing a full day of
 * fittings one at a time was the friction; this is the same single-row
 * `update` the quick-status form already uses, just fanned out. */
export async function bulkCompleteAppointments(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const appointmentIds = formData
    .getAll("appointmentIds")
    .map(String)
    .filter(Boolean);
  if (appointmentIds.length === 0) return;

  const repository = new AppointmentRepository(await getSupabaseServerClient());
  await Promise.all(
    appointmentIds.map((id) =>
      repository.update(asId<"AppointmentId">(id), { status: "completed" }),
    ),
  );
  revalidatePath("/appointments");
}
