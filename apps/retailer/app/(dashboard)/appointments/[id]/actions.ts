"use server";

import { requireRetailerRole } from "@paon/auth";
import { AppointmentRepository } from "@paon/database";
import { asId, updateAppointmentInputSchema } from "@paon/domain";
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

  try {
    await new AppointmentRepository(supabase).update(
      asId<"AppointmentId">(appointmentId),
      {
        ...(parsed.data.status !== undefined
          ? { status: parsed.data.status }
          : {}),
        ...(parsed.data.staffId !== undefined
          ? { staffId: asId<"StaffId">(parsed.data.staffId) }
          : {}),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/appointments/${appointmentId}`);
  return {};
}
