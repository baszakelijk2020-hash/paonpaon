"use server";

import { CampaignRepository } from "@paon/database";
import {
  setCampaignTargetInputSchema,
  upsertRetailerCampaignInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function upsertCampaign(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = upsertRetailerCampaignInputSchema.parse({
    campaignId: formData.get("campaignId") || undefined,
    kind: formData.get("kind"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    active: formData.get("active") === "true",
    paused: formData.get("paused") === "true",
    scheduleFrequency: formData.get("scheduleFrequency") ?? "weekly",
    timezone: formData.get("timezone") ?? "UTC",
    rewardKind: formData.get("rewardKind") || undefined,
    rewardCapPerCustomer: Number(formData.get("rewardCapPerCustomer") ?? "1"),
    rewardExpiresDays: formData.get("rewardExpiresDays")
      ? Number(formData.get("rewardExpiresDays"))
      : undefined,
    requiresPersonalizationConsent:
      formData.get("requiresPersonalizationConsent") !== "false",
    minimumLoyaltyTier: formData.get("minimumLoyaltyTier") || undefined,
  });

  await new CampaignRepository(await getSupabaseServerClient()).upsertCampaign(
    session.retailerId,
    parsed,
  );
  revalidatePath("/settings/campaigns");
}

export async function setCampaignTarget(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = setCampaignTargetInputSchema.parse({
    campaignId: formData.get("campaignId"),
    targetType: "product",
    targetId: formData.get("productId"),
    label: formData.get("label"),
    remove: formData.get("remove") === "true",
  });

  await new CampaignRepository(await getSupabaseServerClient()).setTarget(
    session.retailerId,
    parsed,
  );
  revalidatePath("/settings/campaigns");
}

export async function toggleCampaignPaused(formData: FormData): Promise<void> {
  const session = await requireSession();
  const campaignId = String(formData.get("campaignId"));
  const paused = formData.get("paused") === "true";
  const repo = new CampaignRepository(await getSupabaseServerClient());
  const campaign = await repo.findById(campaignId);
  if (!campaign || campaign.retailerId !== session.retailerId) return;

  await repo.upsertCampaign(session.retailerId, {
    campaignId,
    kind: campaign.kind,
    title: campaign.title,
    description: campaign.description,
    active: campaign.active,
    paused,
    scheduleFrequency: campaign.scheduleFrequency,
    timezone: campaign.timezone,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    rewardKind: campaign.rewardKind,
    rewardCapPerCustomer: campaign.rewardCapPerCustomer,
    rewardExpiresDays: campaign.rewardExpiresDays,
    requiresPersonalizationConsent: campaign.requiresPersonalizationConsent,
    minimumLoyaltyTier: campaign.minimumLoyaltyTier,
  });
  revalidatePath("/settings/campaigns");
}
