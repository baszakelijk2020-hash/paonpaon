"use server";

import { randomUUID } from "node:crypto";

import {
  CustomerRepository,
  RetailerRepository,
  WeddingPartyRepository,
} from "@paon/database";
import {
  addWeddingInspirationItemSchema,
  asId,
  createWeddingPartySchema,
  proposeWeddingDateCandidateSchema,
  setWeddingDesignChoiceSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { sniffImageType } from "@/lib/image-signature";
import { requireSession } from "@/lib/session";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
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
  if ((await sniffImageType(parsed.file)) !== parsed.mimeType) {
    return { formError: "Use a JPEG, PNG or WebP image." };
  }

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
  if ((await sniffImageType(parsed.file)) !== parsed.mimeType) {
    return { formError: "Use a JPEG, PNG or WebP image." };
  }

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

export interface TailoringPartyInviteResult {
  readonly partyId?: string;
  readonly inviteUrl?: string;
  /** The party's link token, which also opens its chat. */
  readonly inviteToken?: string;
  readonly formError?: string;
}

/** The Tailoring Party planner's Send: returns the party's join link —
 * the same one the party page offers to copy — starting the party first
 * when the organizer has none yet. As in `createWeddingParty`, the
 * organizer is resolved from the signed-in customer's own relationship
 * with the atelier, never from input, and an existing party must be one
 * they organize (their latest date, time, location and notes are written
 * back to it, so invitees see the current plan). Nothing is emailed from here: the planner hands the link
 * to the organizer's own mail app, because party invitations have no
 * outbox entry point (ADR-032) yet. */
export async function prepareTailoringPartyInvite(input: {
  retailerId: string;
  partyId?: string;
  eventDate?: string;
  eventTime?: string;
  fittingLocation?: string;
  notes?: string;
}): Promise<TailoringPartyInviteResult> {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(input.retailerId)) return { formError: "Atelier not found." };
  if (input.partyId !== undefined && !uuid.test(input.partyId))
    return { formError: "Party not found." };

  let party;
  if (input.partyId) {
    const owned = await requireOrganizerParty(input.partyId);
    if ("error" in owned) return { formError: owned.error };
    party = owned.party;
    // Keep what invitees see in step with the organizer's latest plan.
    const parsedSchedule = createWeddingPartySchema
      .omit({ organizerCustomerId: true })
      .safeParse({
        eventDate: input.eventDate || undefined,
        eventTime: input.eventTime || undefined,
        fittingLocation: input.fittingLocation || undefined,
        notes: input.notes || undefined,
      });
    if (parsedSchedule.success) {
      await owned.repo.updateSchedule(party.id, {
        ...(parsedSchedule.data.eventDate
          ? { eventDate: parsedSchedule.data.eventDate }
          : {}),
        ...(parsedSchedule.data.eventTime
          ? { eventTime: parsedSchedule.data.eventTime }
          : {}),
        ...(parsedSchedule.data.fittingLocation
          ? { fittingLocation: parsedSchedule.data.fittingLocation }
          : {}),
        ...(parsedSchedule.data.notes
          ? { notes: parsedSchedule.data.notes }
          : {}),
      });
    }
  } else {
    const parsed = createWeddingPartySchema
      .omit({ organizerCustomerId: true })
      .safeParse({
        eventDate: input.eventDate || undefined,
        eventTime: input.eventTime || undefined,
        fittingLocation: input.fittingLocation || undefined,
        notes: input.notes || undefined,
      });
    if (!parsed.success) {
      return {
        formError: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }
    const relationships = await new CustomerRepository(supabase).findByUserId(
      session.userId,
    );
    const customer = relationships.find(
      (c) => c.retailerId === input.retailerId,
    );
    if (!customer) {
      return { formError: "You don't have a relationship with that atelier." };
    }
    try {
      party = await new WeddingPartyRepository(supabase).create({
        retailerId: customer.retailerId,
        organizerCustomerId: customer.id,
        ...(parsed.data.eventDate ? { eventDate: parsed.data.eventDate } : {}),
        ...(parsed.data.eventTime ? { eventTime: parsed.data.eventTime } : {}),
        ...(parsed.data.fittingLocation
          ? { fittingLocation: parsed.data.fittingLocation }
          : {}),
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return {
        formError: message.includes("Too many parties created today")
          ? "You have started enough parties for today."
          : "The party could not be created.",
      };
    }
  }

  const retailer = await new RetailerRepository(supabase).findById(
    party.retailerId,
  );
  if (!retailer) return { formError: "Atelier not found." };
  revalidatePath("/appointments");
  // Invitees land in the Wardrobe's Appointments, where the party sits at
  // the top with their own details to fill in.
  return {
    partyId: party.id,
    inviteUrl: `${env.appUrl}/appointments?party=${encodeURIComponent(party.inviteToken)}`,
    inviteToken: party.inviteToken,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SendTailoringPartyInvitesResult {
  readonly partyId?: string;
  /** Emails that were queued. */
  readonly sent: readonly string[];
  /** Per-email reasons for the ones that were not. */
  readonly failed: readonly { email: string; reason: string }[];
  readonly formError?: string;
}

/** Sends the party invitation from PAON itself: each guest becomes a party
 * member and gets an email with the join link, queued in the email outbox
 * and delivered by the dispatch job (ADR-032). The organizer is proved with
 * their own session first; only then does the service role queue the mail,
 * and the database checks the organizer again. */
export async function sendTailoringPartyInvites(input: {
  retailerId: string;
  partyId?: string;
  eventDate?: string;
  eventTime?: string;
  fittingLocation?: string;
  notes?: string;
  occasion?: "wedding" | "office" | "friends";
  guests: readonly { name: string; email: string }[];
}): Promise<SendTailoringPartyInvitesResult> {
  const guests = input.guests
    .map((guest) => ({
      name: guest.name.trim().slice(0, 200),
      email: guest.email.trim().toLowerCase().slice(0, 320),
    }))
    .filter((guest) => guest.name && guest.email)
    .slice(0, 12);
  if (guests.length === 0) {
    return { sent: [], failed: [], formError: "Add a name and email first." };
  }

  const fittingLocation = input.fittingLocation?.trim().slice(0, 120);
  const occasion =
    input.occasion === "wedding"
      ? "a wedding"
      : input.occasion === "office"
        ? "the office"
        : input.occasion === "friends"
          ? "a get-together with friends"
          : null;

  const prepared = await prepareTailoringPartyInvite({
    retailerId: input.retailerId,
    ...(input.partyId ? { partyId: input.partyId } : {}),
    ...(input.eventDate ? { eventDate: input.eventDate } : {}),
    ...(input.eventTime ? { eventTime: input.eventTime } : {}),
    ...(fittingLocation ? { fittingLocation } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  });
  if (!prepared.partyId || !prepared.inviteUrl) {
    return {
      sent: [],
      failed: [],
      formError: prepared.formError ?? "The invite could not be prepared.",
    };
  }

  const owned = await requireOrganizerParty(prepared.partyId);
  if ("error" in owned) return { sent: [], failed: [], formError: owned.error };
  const organizer = (
    await new CustomerRepository(owned.supabase).findByUserId(
      owned.session.userId,
    )
  ).find((customer) => customer.id === owned.party.organizerCustomerId);
  if (!organizer) {
    return {
      sent: [],
      failed: [],
      formError: "Only the organizer can manage this party.",
    };
  }

  const host = organizer.fullName.trim().slice(0, 80) || "Your friend";
  const when = input.eventDate
    ? `${new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(`${input.eventDate}T00:00:00Z`))}${
        input.eventTime ? ` at ${input.eventTime}` : ""
      }${fittingLocation ? ` in ${fittingLocation}` : ""}`
    : null;
  const subject = `${host} invites you to a tailoring party`.slice(0, 200);
  const repo = new WeddingPartyRepository(getSupabaseAdminClient());

  const sent: string[] = [];
  const failed: { email: string; reason: string }[] = [];
  for (const guest of guests) {
    const html = [
      `<p>Hi ${escapeHtml(guest.name.split(/\s+/)[0] ?? guest.name)},</p>`,
      `<p>${escapeHtml(host)} is getting suited up at Nebel &amp; Spiegel${
        occasion ? ` for ${escapeHtml(occasion)}` : ""
      } and would like you there${
        when ? ` &mdash; the fitting is ${escapeHtml(when)}` : ""
      }.</p>`,
      `<p><a href="${escapeHtml(prepared.inviteUrl)}">Join the party and set up your profile</a></p>`,
      `<p style="color:#777;font-size:12px">If the button does not work, open ${escapeHtml(prepared.inviteUrl)}</p>`,
    ].join("\n");
    try {
      await repo.inviteGuestByEmail({
        weddingPartyId: owned.party.id,
        organizerCustomerId: organizer.id,
        name: guest.name,
        email: guest.email,
        subject,
        htmlBody: html,
      });
      sent.push(guest.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // Only the database's own limit messages reach the browser.
      const known = [
        "Invitation limit reached for today",
        "This address was invited recently",
        "This address cannot be invited",
        "A valid email is required",
        "Too many parties created today",
      ].find((text) => message.includes(text));
      failed.push({ email: guest.email, reason: known ?? "Could not send." });
    }
  }

  revalidatePath("/appointments");
  return { partyId: owned.party.id, sent, failed };
}

export interface PartyMessage {
  readonly id: string;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
  readonly isOrganizer: boolean;
}

const INVITE_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function chatError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  return raw && raw.length <= 160 ? raw : "The chat is unavailable just now.";
}

/** The party chat, for anyone holding the party's link — signed in or not.
 * `list_wedding_party_messages` checks the token; nothing else is trusted. */
export async function listPartyMessages(
  inviteToken: string,
): Promise<{ messages?: PartyMessage[]; formError?: string }> {
  if (!INVITE_TOKEN_PATTERN.test(inviteToken)) {
    return { formError: "Invite link is no longer valid." };
  }
  try {
    const supabase = await getSupabaseServerClient();
    return {
      messages: await new WeddingPartyRepository(supabase).listMessages(
        inviteToken,
      ),
    };
  } catch (error) {
    return { formError: chatError(error) };
  }
}

/** Posts to the party chat; `post_wedding_party_message` checks the token,
 * the name and the length, and rate-limits the party. */
export async function postPartyMessage(input: {
  inviteToken: string;
  authorName: string;
  body: string;
}): Promise<{ ok?: boolean; formError?: string }> {
  if (!INVITE_TOKEN_PATTERN.test(input.inviteToken)) {
    return { formError: "Invite link is no longer valid." };
  }
  const authorName = input.authorName.trim().slice(0, 120);
  const body = input.body.trim().slice(0, 1000);
  if (!authorName) return { formError: "Add your name first." };
  if (!body) return { formError: "Write a message first." };
  try {
    const supabase = await getSupabaseServerClient();
    await new WeddingPartyRepository(supabase).postMessage({
      inviteToken: input.inviteToken,
      authorName,
      body,
    });
    return { ok: true };
  } catch (error) {
    return { formError: chatError(error) };
  }
}

/** A guest saying whether they come to the group fitting. The function
 * checks the party's token and that the member is in that party. */
export async function setPartyAttendance(input: {
  inviteToken: string;
  memberId: string;
  attendance: "attending" | "declined" | "rebooked";
}): Promise<{ ok?: boolean; formError?: string }> {
  if (
    !INVITE_TOKEN_PATTERN.test(input.inviteToken) ||
    !INVITE_TOKEN_PATTERN.test(input.memberId)
  ) {
    return { formError: "Invite link is no longer valid." };
  }
  try {
    const supabase = await getSupabaseServerClient();
    await new WeddingPartyRepository(supabase).setMemberAttendance(input);
    revalidatePath("/appointments");
    return { ok: true };
  } catch (error) {
    return { formError: chatError(error) };
  }
}
