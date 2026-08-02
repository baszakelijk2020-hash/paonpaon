"use server";

import { requireRetailerRole } from "@paon/auth";
import { GiftRepository, RetailerStaffRepository } from "@paon/database";
import {
  composeGiftExperienceInputSchema,
  sendGiftInvitationInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function composeGiftExperience(formData: FormData) {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "manager");

  const expiresAtRaw = formData.get("expiresAt");
  const value = composeGiftExperienceInputSchema.parse({
    title: formData.get("title"),
    introMessage: formData.get("introMessage"),
    ...(expiresAtRaw
      ? { expiresAt: new Date(String(expiresAtRaw)).toISOString() }
      : {}),
    productVariantIds: formData.getAll("productVariantIds"),
  });

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("Staff record not found");

  const giftRepo = new GiftRepository(supabase);
  const experience = await giftRepo.createExperience(
    session.retailerId,
    staff.id,
    {
      title: value.title,
      introMessage: value.introMessage,
      ...(value.expiresAt ? { expiresAt: value.expiresAt } : {}),
    },
  );
  await Promise.all(
    value.productVariantIds.map((productVariantId, index) =>
      giftRepo.addCuratedItem(experience.id, {
        productVariantId,
        sortOrder: index,
      }),
    ),
  );

  revalidatePath("/gifts");
  redirect("/gifts");
}

export async function sendGiftInvitation(formData: FormData) {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "manager");

  const value = sendGiftInvitationInputSchema.parse({
    giftExperienceId: formData.get("giftExperienceId"),
    recipientName: formData.get("recipientName") || undefined,
    recipientEmail: formData.get("recipientEmail") || undefined,
  });

  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("Staff record not found");

  await new GiftRepository(supabase).createInvitation(
    value.giftExperienceId as never,
    staff.id,
    {
      ...(value.recipientName ? { recipientName: value.recipientName } : {}),
      ...(value.recipientEmail ? { recipientEmail: value.recipientEmail } : {}),
    },
  );

  revalidatePath("/gifts");
}

export async function revokeGiftExperience(formData: FormData) {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "manager");
  const giftExperienceId = String(formData.get("giftExperienceId"));
  await new GiftRepository(
    await getSupabaseServerClient(),
  ).updateExperienceStatus(giftExperienceId as never, "revoked");
  revalidatePath("/gifts");
}
