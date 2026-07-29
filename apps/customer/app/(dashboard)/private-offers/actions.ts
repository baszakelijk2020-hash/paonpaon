"use server";

import { CampaignRepository } from "@paon/database";
import {
  CAMPAIGN_REQUIRED_LOOK_SLOTS,
  completeCampaignChallengeInputSchema,
  enrollCampaignChallengeInputSchema,
  upsertCampaignChallengeLookInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function enrollCampaignChallenge(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = enrollCampaignChallengeInputSchema.parse({
    campaignId: formData.get("campaignId"),
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
  });
  await new CampaignRepository(await getSupabaseServerClient()).enrollChallenge(
    parsed,
  );
  revalidatePath("/private-offers");
}

export async function saveCampaignChallengeLook(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const slots: { slotKind: string; productId: string }[] =
    CAMPAIGN_REQUIRED_LOOK_SLOTS.flatMap((slotKind) => {
      const productId = formData.get(`slot_${slotKind}`);
      if (!productId || String(productId) === "") return [];
      return [{ slotKind, productId: String(productId) }];
    });
  const accessories = formData.get("slot_accessories");
  if (accessories && String(accessories) !== "") {
    slots.push({
      slotKind: "accessories",
      productId: String(accessories),
    });
  }
  const parsed = upsertCampaignChallengeLookInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    dayIndex: Number(formData.get("dayIndex")),
    title: formData.get("title"),
    slots,
  });
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).upsertChallengeLook(parsed);
  revalidatePath("/private-offers");
}

export async function completeCampaignChallenge(
  formData: FormData,
): Promise<void> {
  await requireSession();
  const parsed = completeCampaignChallengeInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
  });
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).completeChallenge(parsed.enrollmentId);
  revalidatePath("/private-offers");
}
