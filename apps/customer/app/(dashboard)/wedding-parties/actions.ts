"use server";

import { WeddingPartyRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** A member marking their own fitting "scheduled" — RLS/RPC only
 * allows this exact self-transition (see
 * update_wedding_party_member_status, ADR-035); anything else raises. */
export async function markFittingScheduled(formData: FormData) {
  await requireSession();
  const memberId = String(formData.get("memberId"));
  const weddingPartyId = String(formData.get("weddingPartyId"));
  await new WeddingPartyRepository(
    await getSupabaseServerClient(),
  ).updateMemberFittingStatus(memberId, "scheduled");
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
}
