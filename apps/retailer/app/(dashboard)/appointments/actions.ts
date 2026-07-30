"use server";

import { requireRetailerRole } from "@paon/auth";
import { AppointmentRepository, WorkflowRepository } from "@paon/database";
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

  const supabase = await getSupabaseServerClient();
  const id = asId<"AppointmentId">(appointmentId);
  const current = await new AppointmentRepository(supabase).findById(id);
  if (!current || current.status === parsed.data.status) return;

  await new WorkflowRepository(supabase).transitionAppointment({
    appointmentId: id,
    toState: parsed.data.status,
    ...(current.staffId ? { staffId: current.staffId } : {}),
    ...(current.branchId ? { branchId: current.branchId } : {}),
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

/** Bulk row-select completion — a floor advisor clearing a full day of
 * fittings one at a time was the friction; this is the same single-row
 * workflow transition the quick-status form already uses, just fanned out. */
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

  const supabase = await getSupabaseServerClient();
  const appointmentRepo = new AppointmentRepository(supabase);
  const workflowRepo = new WorkflowRepository(supabase);

  await Promise.all(
    appointmentIds.map(async (idValue) => {
      const id = asId<"AppointmentId">(idValue);
      const current = await appointmentRepo.findById(id);
      if (!current || current.status === "completed") return;
      await workflowRepo.transitionAppointment({
        appointmentId: id,
        toState: "completed",
        ...(current.staffId ? { staffId: current.staffId } : {}),
        ...(current.branchId ? { branchId: current.branchId } : {}),
      });
    }),
  );
  revalidatePath("/appointments");
}
