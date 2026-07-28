"use server";

import { CustomerRepository, WeddingPartyRepository } from "@paon/database";
import { createWeddingPartySchema } from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export interface CreateWeddingPartyState {
  formError?: string;
}

/** The customer-initiated counterpart to the retailer's own
 * `createWeddingParty` action — same repository call, but the organizer
 * is resolved from the signed-in customer's own relationship with the
 * chosen retailer rather than trusted from form input, so a customer can
 * never start a party organized by someone else's customer record. */
export async function createWeddingParty(
  _prevState: CreateWeddingPartyState,
  formData: FormData,
): Promise<CreateWeddingPartyState> {
  const session = await requireSession();
  const retailerId = String(formData.get("retailerId") || "");
  const parsed = createWeddingPartySchema
    .omit({ organizerCustomerId: true })
    .safeParse({
      eventDate: formData.get("eventDate") || undefined,
      venueName: formData.get("venueName") || undefined,
      notes: formData.get("notes") || undefined,
    });
  if (!retailerId) {
    return { formError: "Choose which atelier this party is with." };
  }
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await getSupabaseServerClient();
  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const customer = relationships.find((c) => c.retailerId === retailerId);
  if (!customer) {
    return { formError: "You don't have a relationship with that atelier." };
  }

  const party = await new WeddingPartyRepository(supabase).create({
    retailerId: customer.retailerId,
    organizerCustomerId: customer.id,
    ...(parsed.data.eventDate ? { eventDate: parsed.data.eventDate } : {}),
    ...(parsed.data.venueName ? { venueName: parsed.data.venueName } : {}),
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
  });
  redirect(`/wedding-parties/${party.id}`);
}
