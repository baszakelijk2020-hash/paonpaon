"use server";

import { requireRetailerRole } from "@paon/auth";
import { LoyaltyRepository } from "@paon/database";
import { loyaltyProgramSchema, rewardSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function saveProgram(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const values = loyaltyProgramSchema.parse({
    name: formData.get("name"),
    enabled: formData.get("enabled") === "on",
    pointsPerCurrencyUnit: formData.get("pointsPerCurrencyUnit"),
    referralPoints: formData.get("referralPoints"),
  });
  await new LoyaltyRepository(await getSupabaseServerClient()).saveProgram(
    session.retailerId,
    values,
  );
  revalidatePath("/loyalty");
}

export async function createReward(formData: FormData) {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "manager");
  const values = rewardSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    pointsCost: formData.get("pointsCost"),
    minimumTier: formData.get("minimumTier") || undefined,
  });
  await new LoyaltyRepository(await getSupabaseServerClient()).createReward(
    session.retailerId,
    {
      name: values.name,
      type: values.type,
      pointsCost: values.pointsCost,
      ...(values.minimumTier ? { minimumTier: values.minimumTier } : {}),
    },
  );
  revalidatePath("/loyalty");
}
