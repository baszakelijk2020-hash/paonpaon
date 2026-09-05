"use server";

import { randomUUID } from "node:crypto";

import { CustomerRepository, WeddingPartyRepository } from "@paon/database";
import {
  addWeddingInspirationItemSchema,
  asId,
  createWeddingPartySchema,
  proposeWeddingDateCandidateSchema,
  setWeddingDesignChoiceSchema,
} from "@paon/domain";
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

/** The organizer or the assigned member marking one "delivery and pickup
 * readiness" instruction done — complete_wedding_aftercare_plan
 * re-derives the caller's membership server-side and raises for anyone
 * else, so this has nothing further to check. */
export async function completeAftercarePlan(formData: FormData) {
  await requireSession();
  const planId = String(formData.get("planId"));
  const weddingPartyId = String(formData.get("weddingPartyId"));
  await new WeddingPartyRepository(
    await getSupabaseServerClient(),
  ).completeAftercarePlan(planId as never);
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
}

/** The recipient's party (organizer or any member) redeeming a guest
 * voucher — redeem_wedding_guest_voucher re-derives party membership,
 * idempotency and expiry server-side, so this has nothing further to
 * check. A thrown error (wrong party, already redeemed, expired) surfaces
 * to the browser as a real failure — the button never optimistically
 * flips to "Redeemed" before the server confirms it. */
export async function redeemGuestVoucher(formData: FormData) {
  await requireSession();
  const voucherId = String(formData.get("voucherId"));
  const weddingPartyId = String(formData.get("weddingPartyId"));
  await new WeddingPartyRepository(
    await getSupabaseServerClient(),
  ).redeemGuestVoucherAsCustomer(voucherId as never);
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
}

export interface AddInspirationItemState {
  formError?: string;
}

/** Organizer or member only — add_wedding_inspiration_item re-derives
 * membership and the caller's own customer id server-side, so this has
 * nothing further to check. */
export async function addWeddingInspirationItem(
  weddingPartyId: string,
  _prev: AddInspirationItemState,
  formData: FormData,
): Promise<AddInspirationItemState> {
  await requireSession();
  const parsed = addWeddingInspirationItemSchema.safeParse({
    weddingPartyId,
    imageRef: formData.get("imageRef") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Add an image or a note",
    };
  }
  try {
    await new WeddingPartyRepository(
      await getSupabaseServerClient(),
    ).addInspirationItem({
      weddingPartyId: asId<"WeddingPartyId">(parsed.data.weddingPartyId),
      ...(parsed.data.imageRef ? { imageRef: parsed.data.imageRef } : {}),
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Could not save",
    };
  }
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
  return {};
}

export interface SetDesignChoiceState {
  formError?: string;
}

/** A member setting their own outfit choice, or the organizer setting a
 * party-wide "coordinated" choice — set_wedding_design_choice re-derives
 * membership/organizer authorization server-side, so this has nothing
 * further to check. */
export async function setWeddingDesignChoice(
  weddingPartyId: string,
  _prev: SetDesignChoiceState,
  formData: FormData,
): Promise<SetDesignChoiceState> {
  await requireSession();
  const parsed = setWeddingDesignChoiceSchema.safeParse({
    weddingPartyId,
    weddingPartyMemberId: formData.get("weddingPartyMemberId") || undefined,
    slotKey: formData.get("slotKey"),
    valueKey: formData.get("valueKey"),
    coordinated: formData.get("coordinated") === "on",
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Check the choice fields.",
    };
  }
  try {
    await new WeddingPartyRepository(
      await getSupabaseServerClient(),
    ).setDesignChoice({
      weddingPartyId: asId<"WeddingPartyId">(parsed.data.weddingPartyId),
      ...(parsed.data.weddingPartyMemberId
        ? {
            weddingPartyMemberId: asId<"WeddingPartyMemberId">(
              parsed.data.weddingPartyMemberId,
            ),
          }
        : {}),
      slotKey: parsed.data.slotKey,
      valueKey: parsed.data.valueKey,
      coordinated: parsed.data.coordinated,
    });
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Could not save",
    };
  }
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
  return {};
}

export interface ProposeDateCandidateState {
  formError?: string;
}

/** Organizer or member — propose_wedding_date_candidate re-derives
 * authorization server-side and is idempotent on (party, date). */
export async function proposeWeddingDateCandidate(
  weddingPartyId: string,
  _prev: ProposeDateCandidateState,
  formData: FormData,
): Promise<ProposeDateCandidateState> {
  await requireSession();
  const parsed = proposeWeddingDateCandidateSchema.safeParse({
    weddingPartyId,
    candidateDate: formData.get("candidateDate"),
  });
  if (!parsed.success) {
    return {
      formError: parsed.error.issues[0]?.message ?? "Choose a valid date",
    };
  }
  try {
    await new WeddingPartyRepository(
      await getSupabaseServerClient(),
    ).proposeDateCandidate(
      asId<"WeddingPartyId">(parsed.data.weddingPartyId),
      parsed.data.candidateDate,
    );
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Could not save",
    };
  }
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
  return {};
}

/** Toggles the caller's own vote — toggle_wedding_date_vote resolves the
 * caller's own member row server-side, so this has nothing further to
 * check. */
export async function toggleWeddingDateVote(formData: FormData) {
  await requireSession();
  const candidateId = String(formData.get("candidateId"));
  const weddingPartyId = String(formData.get("weddingPartyId"));
  await new WeddingPartyRepository(
    await getSupabaseServerClient(),
  ).toggleDateVote(candidateId as never);
  revalidatePath(`/wedding-parties/${weddingPartyId}`);
}

/** Organizer only — sets the party's event_date to the chosen candidate,
 * reusing the same organizer-update RLS path as updatePartySchedule rather
 * than a new RPC. */
export async function finalizeWeddingDate(formData: FormData) {
  const partyId = String(formData.get("weddingPartyId"));
  const candidateDate = String(formData.get("candidateDate"));
  const gate = await requireOrganizerParty(partyId);
  if ("error" in gate) return;
  await gate.repo.updateSchedule(gate.party.id, { eventDate: candidateDate });
  revalidatePath(`/wedding-parties/${partyId}`);
}

export interface CreateWeddingPartyState {
  formError?: string;
}

export interface PartyPhotoActionState {
  formError?: string;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

async function requireOrganizerParty(partyId: string) {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const repo = new WeddingPartyRepository(supabase);
  const party = await repo.findById(asId<"WeddingPartyId">(partyId));
  if (!party) return { error: "Party not found." as const };
  const relationships = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const isOrganizer = relationships.some(
    (customer) => customer.id === party.organizerCustomerId,
  );
  if (!isOrganizer) {
    return { error: "Only the organizer can manage this party." as const };
  }
  return { session, supabase, repo, party };
}

function parseImageFile(formData: FormData):
  | { error: string }
  | {
      file: File;
      mimeType: (typeof ALLOWED_IMAGE_TYPES)[number];
    } {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Images must be 5 MB or smaller." };
  }
  if (
    !ALLOWED_IMAGE_TYPES.includes(
      file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
    )
  ) {
    return { error: "Use a JPEG, PNG or WebP image." };
  }
  return {
    file,
    mimeType: file.type as (typeof ALLOWED_IMAGE_TYPES)[number],
  };
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
      eventTime: formData.get("eventTime") || undefined,
      venueName: formData.get("venueName") || undefined,
      fittingLocation: formData.get("fittingLocation") || undefined,
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
    ...(parsed.data.eventTime ? { eventTime: parsed.data.eventTime } : {}),
    ...(parsed.data.venueName ? { venueName: parsed.data.venueName } : {}),
    ...(parsed.data.fittingLocation
      ? { fittingLocation: parsed.data.fittingLocation }
      : {}),
    ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
  });
  redirect(`/wedding-parties/${party.id}`);
}

export async function uploadPartyCoverPhoto(
  partyId: string,
  _prev: PartyPhotoActionState,
  formData: FormData,
): Promise<PartyPhotoActionState> {
  const gate = await requireOrganizerParty(partyId);
  if ("error" in gate) return { formError: gate.error };
  const parsed = parseImageFile(formData);
  if ("error" in parsed) return { formError: parsed.error };

  const safeName = parsed.file.name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-120);
  const storagePath = `${gate.party.retailerId}/${gate.party.id}/cover-${randomUUID()}-${safeName}`;

  try {
    if (gate.party.coverPhotoUrl) {
      await gate.repo.removePartyPhotoByPublicUrl(gate.party.coverPhotoUrl);
    }
    const publicUrl = await gate.repo.uploadPartyPhoto({
      storagePath,
      mimeType: parsed.mimeType,
      content: await parsed.file.arrayBuffer(),
    });
    await gate.repo.setCoverPhotoUrl(gate.party.id, publicUrl);
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Upload failed",
    };
  }
  revalidatePath(`/wedding-parties/${partyId}`);
  return {};
}

export async function uploadMemberPhoto(
  partyId: string,
  memberId: string,
  _prev: PartyPhotoActionState,
  formData: FormData,
): Promise<PartyPhotoActionState> {
  const gate = await requireOrganizerParty(partyId);
  if ("error" in gate) return { formError: gate.error };
  const parsed = parseImageFile(formData);
  if ("error" in parsed) return { formError: parsed.error };

  const members = await gate.repo.findMembers(gate.party.id);
  const member = members.find((item) => item.id === memberId);
  if (!member) return { formError: "Member not found." };

  const safeName = parsed.file.name
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(-120);
  const storagePath = `${gate.party.retailerId}/${gate.party.id}/members/${member.id}-${randomUUID()}-${safeName}`;

  try {
    if (member.photoUrl) {
      await gate.repo.removePartyPhotoByPublicUrl(member.photoUrl);
    }
    const publicUrl = await gate.repo.uploadPartyPhoto({
      storagePath,
      mimeType: parsed.mimeType,
      content: await parsed.file.arrayBuffer(),
    });
    await gate.repo.setMemberPhotoUrl(member.id, publicUrl);
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Upload failed",
    };
  }
  revalidatePath(`/wedding-parties/${partyId}`);
  return {};
}

export interface UpdatePartyScheduleState {
  formError?: string;
  success?: string;
}

export async function updatePartySchedule(
  partyId: string,
  _prev: UpdatePartyScheduleState,
  formData: FormData,
): Promise<UpdatePartyScheduleState> {
  const gate = await requireOrganizerParty(partyId);
  if ("error" in gate) return { formError: gate.error };
  const parsed = createWeddingPartySchema
    .omit({ organizerCustomerId: true })
    .safeParse({
      eventDate: formData.get("eventDate") || undefined,
      eventTime: formData.get("eventTime") || undefined,
      venueName: formData.get("venueName") || undefined,
      fittingLocation: formData.get("fittingLocation") || undefined,
      notes: formData.get("notes") || undefined,
    });
  if (!parsed.success) {
    return {
      formError:
        parsed.error.issues[0]?.message ?? "Check the schedule fields.",
    };
  }
  try {
    await gate.repo.updateSchedule(gate.party.id, {
      ...(parsed.data.eventDate ? { eventDate: parsed.data.eventDate } : {}),
      ...(parsed.data.eventTime ? { eventTime: parsed.data.eventTime } : {}),
      ...(parsed.data.venueName ? { venueName: parsed.data.venueName } : {}),
      ...(parsed.data.fittingLocation
        ? { fittingLocation: parsed.data.fittingLocation }
        : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    });
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Update failed",
    };
  }
  revalidatePath(`/wedding-parties/${partyId}`);
  return { success: "Schedule saved." };
}
