"use server";

import { requireRetailerRole } from "@paon/auth";
import { LoyaltyRepository } from "@paon/database";
import {
  asId,
  loyaltyMilestoneDefinitionSchema,
  loyaltyProgramSchema,
  rewardSchema,
  upsertBuiltInMilestonePointsSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function saveProgram(formData: FormData) {
  const session = await requireModuleSession("commerce_growth");
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
  const session = await requireModuleSession("commerce_growth");
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

export async function saveBuiltInMilestone(formData: FormData) {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "manager");
  const values = upsertBuiltInMilestonePointsSchema.parse({
    kind: formData.get("kind"),
    points: formData.get("points"),
    active: formData.get("active") === "on",
  });
  await new LoyaltyRepository(
    await getSupabaseServerClient(),
  ).upsertBuiltInMilestoneDefinition(session.retailerId, {
    kind: values.kind,
    points: values.points,
    active: values.active,
  });
  revalidatePath("/loyalty");
}

export async function createPeerMilestone(formData: FormData) {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "manager");
  const conceptRaw = String(formData.get("matchConceptIds") ?? "");
  const matchConceptIds = conceptRaw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const values = loyaltyMilestoneDefinitionSchema.parse({
    kind: "custom",
    customKey: formData.get("customKey"),
    label: formData.get("label"),
    explanation: formData.get("explanation"),
    points: formData.get("points"),
    matchConceptIds,
    active: true,
  });
  await new LoyaltyRepository(
    await getSupabaseServerClient(),
  ).createPeerMilestoneDefinition(session.retailerId, {
    customKey: values.customKey!,
    label: values.label,
    explanation: values.explanation,
    points: values.points,
    matchConceptIds: values.matchConceptIds.map((id) =>
      asId<"MetadataConceptId">(id),
    ),
    active: values.active,
  });
  revalidatePath("/loyalty");
}
