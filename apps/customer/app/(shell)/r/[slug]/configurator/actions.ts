"use server";

import { SuitConfiguratorRepository } from "@paon/database";
import { asId, saveSuitConfigurationIntentSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { assertRetailerModuleActive } from "@/lib/module-session";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface SaveSuitConfigurationState {
  formError?: string;
  success?: boolean;
}

/** Saves the customer's current lapel/pockets/shoulder pick — an explicit
 * "save" action separate from exploring the widget, matching the swipe
 * deck / wardrobe rail precedent of an explicit persisted decision rather
 * than saving on every scroll settle. */
export async function saveSuitConfiguration(
  slug: string,
  retailerId: string,
  _prev: SaveSuitConfigurationState,
  formData: FormData,
): Promise<SaveSuitConfigurationState> {
  await requireSession();
  const rawModelPreset = formData.get("modelPreset");
  const parsed = saveSuitConfigurationIntentSchema.safeParse({
    lapel: formData.get("lapel"),
    pockets: formData.get("pockets"),
    shoulder: formData.get("shoulder"),
    ...(rawModelPreset ? { modelPreset: Number(rawModelPreset) } : {}),
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Invalid selection",
    };
  }

  const supabase = await getSupabaseServerClient();
  const rId = asId<"RetailerId">(retailerId);
  await assertRetailerModuleActive(supabase, rId, "wardrobe_styling");
  const { modelPreset, ...rest } = parsed.data;
  await new SuitConfiguratorRepository(supabase).save(rId, {
    ...rest,
    ...(modelPreset ? { modelPreset } : {}),
  });

  revalidatePath(`/r/${slug}/configurator`);
  return { success: true };
}
