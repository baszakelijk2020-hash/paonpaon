"use server";

import { requireRetailerRole } from "@paon/auth";
import { WorkflowDefinitionRepository } from "@paon/database";
import {
  FAMILIARITY_PRESET_KEYS,
  type FamiliarityPresetKey,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function setFamiliarityPresetAction(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "admin");

  const presetKey = String(formData.get("presetKey") ?? "");
  if (!FAMILIARITY_PRESET_KEYS.includes(presetKey as FamiliarityPresetKey)) {
    throw new Error("Unknown familiarity preset");
  }

  const supabase = await getSupabaseServerClient();
  await new WorkflowDefinitionRepository(supabase).setRetailerPreset({
    retailerId: session.retailerId,
    presetKey: presetKey as FamiliarityPresetKey,
  });

  revalidatePath("/settings/workflows");
  revalidatePath("/dashboard");
  revalidatePath("/alterations");
}
