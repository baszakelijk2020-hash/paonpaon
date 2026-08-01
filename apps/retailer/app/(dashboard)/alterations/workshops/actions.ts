"use server";

import { requireAlterationsPermission } from "@paon/auth";
import { WorkshopRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface WorkshopFormState {
  formError?: string;
  success?: boolean;
}

export async function createWorkshop(
  _state: WorkshopFormState,
  formData: FormData,
): Promise<WorkshopFormState> {
  const session = await requireModuleSession("garment_service_operations");
  requireAlterationsPermission(session.retailerRole, "configure");
  const name = formData.get("name");
  if (typeof name !== "string" || name.trim().length < 2) {
    return { formError: "Workshop name is required." };
  }
  const email = formData.get("email");
  const phone = formData.get("phone");
  try {
    await new WorkshopRepository(await getSupabaseServerClient()).create({
      retailerId: session.retailerId,
      name: name.trim(),
      ...(typeof email === "string" && email ? { email: email.trim() } : {}),
      ...(typeof phone === "string" && phone ? { phone: phone.trim() } : {}),
    });
  } catch (error) {
    return {
      formError:
        error instanceof Error ? error.message : "Unable to add workshop.",
    };
  }
  revalidatePath("/alterations/workshops");
  return { success: true };
}
