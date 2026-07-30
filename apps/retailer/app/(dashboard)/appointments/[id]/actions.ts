"use server";

import { requireRetailerRole } from "@paon/auth";
import { AppointmentRepository, WorkflowRepository } from "@paon/database";
import { asId, updateAppointmentInputSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface UpdateAppointmentFormState {
  formError?: string;
}

export async function updateAppointment(
  appointmentId: string,
  _prevState: UpdateAppointmentFormState,
  formData: FormData,
): Promise<UpdateAppointmentFormState> {
  const session = await requireSession();
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
  const appointmentRepo = new AppointmentRepository(supabase);
  const workflowRepo = new WorkflowRepository(supabase);
  const id = asId<"AppointmentId">(appointmentId);

  try {
    if (parsed.data.status !== undefined) {
      const current = await appointmentRepo.findById(id);
      if (!current) {
        return { formError: "Appointment not found." };
      }

      if (parsed.data.status !== current.status) {
        await workflowRepo.transitionAppointment({
          appointmentId: id,
          toState: parsed.data.status,
          ...(parsed.data.staffId !== undefined
            ? { staffId: asId<"StaffId">(parsed.data.staffId) }
            : current.staffId
              ? { staffId: current.staffId }
              : {}),
          ...(current.branchId ? { branchId: current.branchId } : {}),
        });
      } else if (parsed.data.staffId !== undefined) {
        await appointmentRepo.update(id, {
          staffId: asId<"StaffId">(parsed.data.staffId),
        });
      }
    } else if (parsed.data.staffId !== undefined) {
      await appointmentRepo.update(id, {
        staffId: asId<"StaffId">(parsed.data.staffId),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { formError: message };
  }

  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/appointments");
  return {};
}
