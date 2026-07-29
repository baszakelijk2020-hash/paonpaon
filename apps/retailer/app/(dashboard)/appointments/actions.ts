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
