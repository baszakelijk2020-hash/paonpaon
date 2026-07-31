"use server";

import {
  activateCampaignToStaffMissions,
  CampaignLibraryRepository,
  CampaignRepository,
  rehearseCampaignActivation,
  RetailerStaffRepository,
} from "@paon/database";
import {
  retailerRoleAtLeast,
  setCampaignTargetProductInputSchema,
  upsertCampaignAudienceRuleInputSchema,
  upsertCampaignInputSchema,
  type CampaignRehearsalReport,
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

/**
 * Read-only preview (PHASE 10.1) — persisted via recordRehearsal so the
 * settings page can show the last rehearsal after revalidatePath, without
 * this action itself needing to return a value to a useActionState form.
 *
 * Uses the admin client because rehearsal reads every portal customer's
 * consent and style-profile state on the retailer's behalf, not just the
 * caller's own row — unlike this file's other actions there is no RLS
 * backstop here, so the manager-or-above check below is load-bearing, not
 * a UI nicety.
 */
export async function rehearseCampaign(formData: FormData): Promise<void> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    throw new Error("Only a manager or owner can rehearse a campaign.");
  }
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) throw new Error("Missing campaign.");

  const admin = getSupabaseAdminClient();
  const report: CampaignRehearsalReport = await rehearseCampaignActivation(
    admin,
    { retailerId: session.retailerId, campaignId },
  );
  await new CampaignRepository(admin).recordRehearsal({
    retailerId: session.retailerId,
    campaignId,
    report,
  });
  revalidatePath("/settings/campaigns");
}

/**
 * Activates a campaign into shared staff missions (PHASE 10.1) and sets it
 * live for matching customers in the same step — replaces the plain
 * setCampaignStatus("active") call the button used before this existed.
 * See the rehearseCampaign docstring above for why this uses the admin
 * client and enforces the role check itself.
 */
export async function activateCampaignWithMissions(
  formData: FormData,
): Promise<void> {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    throw new Error("Only a manager or owner can activate a campaign.");
  }
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaignTitle = String(formData.get("campaignTitle") ?? "");
  const staffMission = String(formData.get("staffMission") ?? "");
  if (!campaignId) throw new Error("Missing campaign.");

  const admin = getSupabaseAdminClient();
  const result = await activateCampaignToStaffMissions(admin, {
    retailerId: session.retailerId,
    campaignId,
    campaignTitle,
    staffMission,
  });
  await new CampaignRepository(admin).recordActivation({
    retailerId: session.retailerId,
    campaignId,
    missionsCreated: result.missionsCreated,
  });
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
