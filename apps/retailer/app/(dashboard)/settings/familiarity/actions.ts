"use server";

import { requireRetailerRole } from "@paon/auth";
import { FamiliarityPresetRepository } from "@paon/database";
import { familiarityPresetSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface FamiliarityPresetFormState {
  formError?: string;
  saved?: boolean;
}

export async function updateFamiliarityPreset(
  _prevState: FamiliarityPresetFormState,
  formData: FormData,
): Promise<FamiliarityPresetFormState> {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    return { formError: "Only admins can change familiarity presets." };
  }

  const parsed = familiarityPresetSchema.safeParse({
    presetKey: String(formData.get("presetKey") ?? ""),
  });

  if (!parsed.success) {
    return { formError: "Choose a valid familiarity preset." };
  }

  const supabase = await getSupabaseServerClient();
  await new FamiliarityPresetRepository(supabase).upsertPreset({
    retailerId: session.retailerId,
    presetKey: parsed.data.presetKey,
  });

  revalidatePath("/settings/familiarity");
  revalidatePath("/appointments");
  return { saved: true };
}
