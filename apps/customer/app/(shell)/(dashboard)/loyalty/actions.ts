"use server";

import { LoyaltyRepository } from "@paon/database";
import { referralInviteSchema } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function joinLoyalty(formData: FormData) {
  await requireSession();
  const retailerId = String(formData.get("retailerId"));
  await new LoyaltyRepository(await getSupabaseServerClient()).ensureMyAccount(
    retailerId as never,
  );
  revalidatePath("/loyalty");
}
export async function inviteFriend(formData: FormData) {
  await requireSession();
  const values = referralInviteSchema.parse({
    retailerId: formData.get("retailerId"),
    referredEmail: formData.get("referredEmail"),
  });
  await new LoyaltyRepository(await getSupabaseServerClient()).createMyReferral(
    values.retailerId as never,
    values.referredEmail,
  );
  revalidatePath("/loyalty");
}
export async function redeemReward(formData: FormData) {
  await requireSession();
  await new LoyaltyRepository(await getSupabaseServerClient()).redeemMyReward(
    String(formData.get("rewardId")),
  );
  revalidatePath("/loyalty");
}
