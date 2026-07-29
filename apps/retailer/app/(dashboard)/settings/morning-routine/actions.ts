"use server";

import { MorningRoutineDeliveryRepository } from "@paon/database";
import {
  setMorningRoutineEligibleProductInputSchema,
  setMorningRoutineRetailerPausedInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function setMorningRoutineEligibleProduct(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const parsed = setMorningRoutineEligibleProductInputSchema.parse({
    productId: formData.get("productId"),
    active: formData.get("active") === "true",
  });
  await new MorningRoutineDeliveryRepository(
    await getSupabaseServerClient(),
  ).setEligibleProduct({
    retailerId: session.retailerId,
    productId: parsed.productId,
    active: parsed.active,
  });
  revalidatePath("/settings/morning-routine");
}

export async function setMorningRoutineRetailerPaused(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const parsed = setMorningRoutineRetailerPausedInputSchema.parse({
    paused: formData.get("paused") === "true",
  });
  await new MorningRoutineDeliveryRepository(
    await getSupabaseServerClient(),
  ).setRetailerPaused(session.retailerId, parsed.paused);
  revalidatePath("/settings/morning-routine");
}
