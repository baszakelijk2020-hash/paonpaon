"use server";

import {
  CampaignLibraryRepository,
  CampaignRepository,
  RetailerStaffRepository,
} from "@paon/database";
import {
  setCampaignTargetProductInputSchema,
  upsertCampaignAudienceRuleInputSchema,
  upsertCampaignInputSchema,
  type CampaignStatus,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function upsertCampaign(formData: FormData): Promise<void> {
  const session = await requireSession();
  const quietStart = formData.get("quietStartMinute");
  const quietEnd = formData.get("quietEndMinute");
  const rewardKind = formData.get("rewardKind");
  const parsed = upsertCampaignInputSchema.parse({
    campaignId: formData.get("campaignId") || undefined,
    kind: formData.get("kind"),
    status: formData.get("status") || "draft",
    title: formData.get("title"),
    summary: formData.get("summary"),
    explanation: formData.get("explanation"),
    frequency: formData.get("frequency") || "weekly",
    timezone: formData.get("timezone") || "UTC",
    preferredLocalHour: Number(formData.get("preferredLocalHour") || 9),
    ...(quietStart !== null && String(quietStart) !== ""
      ? { quietStartMinute: Number(quietStart) }
      : {}),
    ...(quietEnd !== null && String(quietEnd) !== ""
      ? { quietEndMinute: Number(quietEnd) }
      : {}),
    ...(rewardKind && String(rewardKind) !== ""
      ? { rewardKind: String(rewardKind) }
      : {}),
    rewardLabel: formData.get("rewardLabel") || undefined,
    rewardCapPerCustomer: Number(formData.get("rewardCapPerCustomer") || 1),
    shortLivedOfferHours: Number(formData.get("shortLivedOfferHours") || 72),
  });
  await new CampaignRepository(await getSupabaseServerClient()).upsertCampaign(
    session.retailerId,
    parsed,
  );
  revalidatePath("/settings/campaigns");
}

export async function setCampaignStatus(formData: FormData): Promise<void> {
  const session = await requireSession();
  const campaignId = String(formData.get("campaignId") ?? "");
  const status = String(formData.get("status") ?? "") as CampaignStatus;
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).setCampaignStatus(session.retailerId, campaignId, status);
  revalidatePath("/settings/campaigns");
}

export async function upsertCampaignAudienceRule(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const parsed = upsertCampaignAudienceRuleInputSchema.parse({
    campaignId: formData.get("campaignId"),
    ruleKind: formData.get("ruleKind"),
    conceptId: formData.get("conceptId") || undefined,
    productId: formData.get("productId") || undefined,
    loyaltyTier: formData.get("loyaltyTier") || undefined,
    requirePersonalizationConsent:
      formData.get("requirePersonalizationConsent") !== "false",
    explanation: formData.get("explanation"),
    active: formData.get("active") !== "false",
  });
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).upsertAudienceRule(session.retailerId, parsed);
  revalidatePath("/settings/campaigns");
}

export async function setCampaignTargetProduct(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  const parsed = setCampaignTargetProductInputSchema.parse({
    campaignId: formData.get("campaignId"),
    productId: formData.get("productId"),
    active: formData.get("active") === "true",
  });
  await new CampaignRepository(
    await getSupabaseServerClient(),
  ).setTargetProduct(session.retailerId, parsed);
  revalidatePath("/settings/campaigns");
}

export async function cloneCampaignFromLibrary(): Promise<void> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  const admin = getSupabaseAdminClient();
  await new CampaignLibraryRepository(admin).ensureMemberFabricV1();
  await new CampaignLibraryRepository(admin).cloneActiveToRetailer({
    retailerId: session.retailerId,
    key: "private_offer_member_fabric",
    ...(staff?.id ? { createdByStaffId: staff.id } : {}),
  });
  revalidatePath("/settings/campaigns");
}
