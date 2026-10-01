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
  const emails = [
    ...new Set(
      formData
        .getAll("referredEmail")
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean),
    ),
  ].slice(0, 10);
  const referrals = [];
  for (const referredEmail of emails) {
    const result = referralInviteSchema.safeParse({
      retailerId: formData.get("retailerId"),
      referredEmail,
    });
    if (result.success) referrals.push(result.data);
  }
  if (referrals.length === 0) return;
  const loyalty = new LoyaltyRepository(await getSupabaseServerClient());
  await Promise.all(
    referrals.map((referral) =>
      loyalty.createMyReferral(
        referral.retailerId as never,
        referral.referredEmail,
      ),
    ),
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
