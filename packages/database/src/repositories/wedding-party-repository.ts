import {
  asId,
  money,
  type CurrencyCode,
  type CustomerId,
  type RetailerId,
  type WeddingAftercarePlan,
  type WeddingAftercarePlanId,
  type WeddingDateCandidate,
  type WeddingDateCandidateId,
  type WeddingDateVote,
  type WeddingDesignChoice,
  type WeddingGroupFitting,
  type WeddingGuestVoucher,
  type WeddingGuestVoucherId,
  type WeddingInspirationItem,
  type WeddingParty,
  type WeddingPartyMember,
  type WeddingPartyMemberFittingStatus,
  type WeddingPartyMemberRole,
  type WeddingPartyId,
  type WeddingPartyMemberId,
  type WeddingPartyStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PartyRow = Database["public"]["Tables"]["wedding_parties"]["Row"];
type MemberRow = Database["public"]["Tables"]["wedding_party_members"]["Row"];
type AftercarePlanRow =
  Database["public"]["Tables"]["wedding_aftercare_plans"]["Row"];
type GroupFittingRow =
  Database["public"]["Tables"]["wedding_group_fittings"]["Row"];
type InspirationItemRow =
  Database["public"]["Tables"]["wedding_inspiration_items"]["Row"];
type DesignChoiceRow =
  Database["public"]["Tables"]["wedding_design_choices"]["Row"];
type DateCandidateRow =
  Database["public"]["Tables"]["wedding_date_candidates"]["Row"];
type DateVoteRow = Database["public"]["Tables"]["wedding_date_votes"]["Row"];
type GuestVoucherRow =
  Database["public"]["Tables"]["wedding_guest_vouchers"]["Row"];

const PARTY_PHOTOS_BUCKET = "party-photos";

const toParty = (row: PartyRow): WeddingParty => ({
  id: asId<"WeddingPartyId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  organizerCustomerId: asId<"CustomerId">(row.organizer_customer_id),
  ...(row.event_date ? { eventDate: row.event_date } : {}),
  ...(row.event_time ? { eventTime: row.event_time.slice(0, 5) } : {}),
  ...(row.venue_name ? { venueName: row.venue_name } : {}),
  ...(row.fitting_location ? { fittingLocation: row.fitting_location } : {}),
  ...(row.cover_photo_url ? { coverPhotoUrl: row.cover_photo_url } : {}),
  status: row.status,
  ...(row.notes ? { notes: row.notes } : {}),
  inviteToken: row.invite_token,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const toMember = (row: MemberRow): WeddingPartyMember => ({
  id: asId<"WeddingPartyMemberId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  customerId: asId<"CustomerId">(row.customer_id),
  name: row.name,
  role: row.role,
  fittingStatus: row.fitting_status,
  ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
  ...(row.height_cm != null ? { heightCm: Number(row.height_cm) } : {}),
  ...(row.weight_kg != null ? { weightKg: Number(row.weight_kg) } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const toAftercarePlan = (row: AftercarePlanRow): WeddingAftercarePlan => ({
  id: asId<"WeddingAftercarePlanId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  ...(row.wedding_party_member_id
    ? {
        weddingPartyMemberId: asId<"WeddingPartyMemberId">(
          row.wedding_party_member_id,
        ),
      }
    : {}),
  instruction: row.instruction,
  ...(row.due_on ? { dueOn: row.due_on } : {}),
  ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  createdAt: row.created_at,
});

const toGroupFitting = (row: GroupFittingRow): WeddingGroupFitting => ({
  id: asId<"WeddingGroupFittingId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  scheduledAt: row.scheduled_at,
  capacity: row.capacity,
  createdAt: row.created_at,
});

const toInspirationItem = (
  row: InspirationItemRow,
): WeddingInspirationItem => ({
  id: asId<"WeddingInspirationItemId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  ...(row.added_by_customer_id
    ? { addedByCustomerId: asId<"CustomerId">(row.added_by_customer_id) }
    : {}),
  ...(row.image_ref ? { imageRef: row.image_ref } : {}),
  ...(row.note ? { note: row.note } : {}),
  internalOnly: row.internal_only,
  createdAt: row.created_at,
});

const toDesignChoice = (row: DesignChoiceRow): WeddingDesignChoice => ({
  id: asId<"WeddingDesignChoiceId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  ...(row.wedding_party_member_id
    ? {
        weddingPartyMemberId: asId<"WeddingPartyMemberId">(
          row.wedding_party_member_id,
        ),
      }
    : {}),
  slotKey: row.slot_key,
  valueKey: row.value_key,
  coordinated: row.coordinated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDateCandidate = (row: DateCandidateRow): WeddingDateCandidate => ({
  id: asId<"WeddingDateCandidateId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  candidateDate: row.candidate_date,
  createdAt: row.created_at,
});

const toDateVote = (row: DateVoteRow): WeddingDateVote => ({
  weddingDateCandidateId: asId<"WeddingDateCandidateId">(
    row.wedding_date_candidate_id,
  ),
  weddingPartyMemberId: asId<"WeddingPartyMemberId">(
    row.wedding_party_member_id,
  ),
  createdAt: row.created_at,
});

const toGuestVoucher = (row: GuestVoucherRow): WeddingGuestVoucher => ({
  id: asId<"WeddingGuestVoucherId">(row.id),
  weddingPartyId: asId<"WeddingPartyId">(row.wedding_party_id),
  guestLabel: row.guest_label,
  value: money(row.value_minor_units, row.currency as CurrencyCode),
  fundingSource: row.funding_source,
  expiresOn: row.expires_on,
  ...(row.redeemed_at ? { redeemedAt: row.redeemed_at } : {}),
  createdAt: row.created_at,
});

/** See `docs/ARCHITECTURE.md` "Data access layer" — the only code
 * allowed to query `wedding_parties`/`wedding_party_members`. */
export class WeddingPartyRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(retailerId: RetailerId): Promise<WeddingParty[]> {
    const { data, error } = await this.client
      .from("wedding_parties")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toParty);
  }

  /** Every party the caller's own customer relationships touch —
   * as organizer or as an invited member (RLS already scopes this,
   * `.or` just avoids two round trips). */
  async findByCustomer(customerId: CustomerId): Promise<WeddingParty[]> {
    const memberRows = await this.client
      .from("wedding_party_members")
      .select("wedding_party_id")
      .eq("customer_id", customerId)
      .is("deleted_at", null);
    if (memberRows.error) throw memberRows.error;
    const memberPartyIds = memberRows.data.map((row) => row.wedding_party_id);

    const { data, error } = await this.client
      .from("wedding_parties")
      .select("*")
      .is("deleted_at", null)
      .or(
        [
          `organizer_customer_id.eq.${customerId}`,
          memberPartyIds.length > 0
            ? `id.in.(${memberPartyIds.join(",")})`
            : undefined,
        ]
          .filter(Boolean)
          .join(","),
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toParty);
  }

  async findById(id: WeddingPartyId): Promise<WeddingParty | null> {
    const { data, error } = await this.client
      .from("wedding_parties")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toParty(data) : null;
  }

  async findMembers(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingPartyMember[]> {
    const { data, error } = await this.client
      .from("wedding_party_members")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .is("deleted_at", null)
      .order("created_at");
    if (error) throw error;
    return data.map(toMember);
  }

  async create(values: {
    retailerId: RetailerId;
    organizerCustomerId: CustomerId;
    eventDate?: string;
    eventTime?: string;
    venueName?: string;
    fittingLocation?: string;
    notes?: string;
  }): Promise<WeddingParty> {
    const id = asId<"WeddingPartyId">(crypto.randomUUID());
    const { error } = await this.client.from("wedding_parties").insert({
      id,
      retailer_id: values.retailerId,
      organizer_customer_id: values.organizerCustomerId,
      ...(values.eventDate ? { event_date: values.eventDate } : {}),
      ...(values.eventTime ? { event_time: values.eventTime } : {}),
      ...(values.venueName ? { venue_name: values.venueName } : {}),
      ...(values.fittingLocation
        ? { fitting_location: values.fittingLocation }
        : {}),
      ...(values.notes ? { notes: values.notes } : {}),
    });
    if (error) throw error;
    const party = await this.findById(id);
    if (!party) {
      throw new Error("Inserted wedding party could not be reloaded");
    }
    return party;
  }

  async updateStatus(
    id: WeddingPartyId,
    status: WeddingPartyStatus,
  ): Promise<void> {
    const { error } = await this.client
      .from("wedding_parties")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  }

  async updateSchedule(
    id: WeddingPartyId,
    values: {
      eventDate?: string;
      eventTime?: string;
      venueName?: string;
      fittingLocation?: string;
      coverPhotoUrl?: string;
      notes?: string;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from("wedding_parties")
      .update({
        ...(values.eventDate !== undefined
          ? { event_date: values.eventDate }
          : {}),
        ...(values.eventTime !== undefined
          ? { event_time: values.eventTime }
          : {}),
        ...(values.venueName !== undefined
          ? { venue_name: values.venueName }
          : {}),
        ...(values.fittingLocation !== undefined
          ? { fitting_location: values.fittingLocation }
          : {}),
        ...(values.coverPhotoUrl !== undefined
          ? { cover_photo_url: values.coverPhotoUrl }
          : {}),
        ...(values.notes !== undefined ? { notes: values.notes } : {}),
      })
      .eq("id", id);
    if (error) throw error;
  }

  async updateMemberPrep(
    memberId: WeddingPartyMemberId,
    values: {
      photoUrl?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
    },
  ): Promise<void> {
    const { error } = await this.client
      .from("wedding_party_members")
      .update({
        ...(values.photoUrl !== undefined
          ? { photo_url: values.photoUrl }
          : {}),
        ...(values.heightCm !== undefined
          ? { height_cm: values.heightCm }
          : {}),
        ...(values.weightKg !== undefined
          ? { weight_kg: values.weightKg }
          : {}),
      })
      .eq("id", memberId);
    if (error) throw error;
  }

  /** Transactional find-or-create-guest-customer + add-member via
   * `add_wedding_party_member` (security definer) — see the migration
   * comment for why this isn't two separate client calls. */
  async addMember(params: {
    weddingPartyId: WeddingPartyId;
    name: string;
    email: string;
    role: WeddingPartyMemberRole;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("add_wedding_party_member", {
      p_wedding_party_id: params.weddingPartyId,
      p_name: params.name,
      p_email: params.email,
      p_role: params.role,
    });
    if (error) throw error;
    return data;
  }

  /** Resolves a token's owning retailer without joining, so a caller can
   * check module state first. `wedding_parties` has no anonymous select
   * policy (ADR-034's "no new anonymous RLS read/insert policy, narrow
   * RPC only"), so this is a narrow RPC mirroring `join_wedding_party`'s
   * own token-validity check rather than a table read. Returns null for
   * an invalid/expired/cancelled token — the join call surfaces that as
   * a thrown error either way. */
  async retailerIdForInvite(inviteToken: string): Promise<RetailerId | null> {
    const { data, error } = await this.client.rpc(
      "wedding_party_retailer_for_invite",
      { p_invite_token: inviteToken },
    );
    if (error) throw error;
    return data ? asId<"RetailerId">(data) : null;
  }

  /** The anonymous join path (`join_wedding_party`, security definer)
   * — no pre-validation read of the invite token beyond the module-state
   * check above, since `wedding_parties`' RLS has no anonymous select
   * policy and never should (ADR-034's "no new anonymous RLS read/insert
   * policy, narrow RPC only"). An invalid token surfaces as a thrown
   * error here. */
  async joinViaInvite(params: {
    inviteToken: string;
    name: string;
    email: string;
    role: WeddingPartyMemberRole;
    heightCm: number;
    weightKg: number;
    photoUrl?: string;
  }): Promise<{
    memberId: string;
    partyId: string;
    retailerId: string;
  }> {
    const { data, error } = await this.client.rpc("join_wedding_party", {
      p_invite_token: params.inviteToken,
      p_name: params.name,
      p_email: params.email,
      p_role: params.role,
      p_height_cm: params.heightCm,
      p_weight_kg: params.weightKg,
      ...(params.photoUrl ? { p_photo_url: params.photoUrl } : {}),
    });
    if (error) throw error;
    const payload = data as {
      member_id: string;
      party_id: string;
      retailer_id: string;
    };
    return {
      memberId: payload.member_id,
      partyId: payload.party_id,
      retailerId: payload.retailer_id,
    };
  }

  async previewInvite(inviteToken: string): Promise<{
    retailerName: string;
    retailerSlug: string;
    eventDate?: string;
    eventTime?: string;
    venueName?: string;
    fittingLocation?: string;
  }> {
    const { data, error } = await this.client.rpc(
      "preview_wedding_party_invite",
      { p_invite_token: inviteToken },
    );
    if (error) throw error;
    const payload = data as {
      retailer_name: string;
      retailer_slug: string;
      event_date: string | null;
      event_time: string | null;
      venue_name: string | null;
      fitting_location: string | null;
    };
    return {
      retailerName: payload.retailer_name,
      retailerSlug: payload.retailer_slug,
      ...(payload.event_date ? { eventDate: payload.event_date } : {}),
      ...(payload.event_time ? { eventTime: payload.event_time } : {}),
      ...(payload.venue_name ? { venueName: payload.venue_name } : {}),
      ...(payload.fitting_location
        ? { fittingLocation: payload.fitting_location }
        : {}),
    };
  }

  async updateMemberFittingStatus(
    memberId: string,
    status: WeddingPartyMemberFittingStatus,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      "update_wedding_party_member_status",
      { p_member_id: memberId, p_status: status },
    );
    if (error) throw error;
  }

  async uploadPartyPhoto(params: {
    storagePath: string;
    mimeType: "image/jpeg" | "image/png" | "image/webp";
    content: ArrayBuffer;
  }): Promise<string> {
    const { error } = await this.client.storage
      .from(PARTY_PHOTOS_BUCKET)
      .upload(params.storagePath, params.content, {
        contentType: params.mimeType,
        upsert: false,
      });
    if (error) throw error;
    return this.client.storage
      .from(PARTY_PHOTOS_BUCKET)
      .getPublicUrl(params.storagePath).data.publicUrl;
  }

  async setCoverPhotoUrl(
    partyId: WeddingPartyId,
    coverPhotoUrl: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("wedding_parties")
      .update({ cover_photo_url: coverPhotoUrl })
      .eq("id", partyId);
    if (error) throw error;
  }

  async setMemberPhotoUrl(
    memberId: WeddingPartyMemberId,
    photoUrl: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("wedding_party_members")
      .update({ photo_url: photoUrl })
      .eq("id", memberId);
    if (error) throw error;
  }

  async removePartyPhotoByPublicUrl(url: string): Promise<void> {
    const marker = `/${PARTY_PHOTOS_BUCKET}/`;
    const index = url.indexOf(marker);
    if (index === -1) return;
    const storagePath = url.slice(index + marker.length);
    const { error } = await this.client.storage
      .from(PARTY_PHOTOS_BUCKET)
      .remove([storagePath]);
    if (error) throw error;
  }

  /** Staff-authored "delivery and pickup readiness" instructions
   * (FT-13). `retailerId` is required at write time — the table has no
   * default-tenant derivation the way the anonymous-write RPCs do,
   * since only retailer staff (never a customer) create these. */
  async createAftercarePlan(params: {
    retailerId: RetailerId;
    weddingPartyId: WeddingPartyId;
    weddingPartyMemberId?: WeddingPartyMemberId;
    instruction: string;
    dueOn?: string;
  }): Promise<WeddingAftercarePlan> {
    const { data, error } = await this.client
      .from("wedding_aftercare_plans")
      .insert({
        retailer_id: params.retailerId,
        wedding_party_id: params.weddingPartyId,
        wedding_party_member_id: params.weddingPartyMemberId ?? null,
        instruction: params.instruction,
        due_on: params.dueOn ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toAftercarePlan(data);
  }

  async findAftercarePlans(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingAftercarePlan[]> {
    const { data, error } = await this.client
      .from("wedding_aftercare_plans")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("created_at");
    if (error) throw error;
    return data.map(toAftercarePlan);
  }

  /** Organizer or assigned member only (`complete_wedding_aftercare_plan`,
   * SECURITY DEFINER) — re-derives the caller's membership server-side
   * rather than trusting a client-supplied customer/member id. */
  async completeAftercarePlan(planId: WeddingAftercarePlanId): Promise<void> {
    const { error } = await this.client.rpc("complete_wedding_aftercare_plan", {
      p_plan_id: planId,
    });
    if (error) throw error;
  }

  /** Plain insert, not an RPC: the caller here is always retailer staff
   * with a real session, so the existing staff-insert RLS policy on
   * `wedding_group_fittings` (owner/manager/admin/sales_associate) is
   * sufficient — unlike the anonymous/customer paths elsewhere, there is
   * no client-supplied identity to re-derive. */
  async createGroupFitting(params: {
    retailerId: RetailerId;
    weddingPartyId: WeddingPartyId;
    scheduledAt: string;
    capacity: number;
  }): Promise<WeddingGroupFitting> {
    const { data, error } = await this.client
      .from("wedding_group_fittings")
      .insert({
        retailer_id: params.retailerId,
        wedding_party_id: params.weddingPartyId,
        scheduled_at: params.scheduledAt,
        capacity: params.capacity,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toGroupFitting(data);
  }

  async findGroupFittings(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingGroupFitting[]> {
    const { data, error } = await this.client
      .from("wedding_group_fittings")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .order("scheduled_at", { ascending: true });
    if (error) throw error;
    return data.map(toGroupFitting);
  }

  async findInspirationItems(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingInspirationItem[]> {
    const { data, error } = await this.client
      .from("wedding_inspiration_items")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toInspirationItem);
  }

  /** SECURITY DEFINER RPC (`add_wedding_inspiration_item`) — re-derives the
   * caller's organizer/member authorization and customer id server-side
   * rather than trusting a client-supplied customer id. */
  async addInspirationItem(params: {
    weddingPartyId: WeddingPartyId;
    imageRef?: string;
    note?: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("add_wedding_inspiration_item", {
      p_wedding_party_id: params.weddingPartyId,
      ...(params.imageRef ? { p_image_ref: params.imageRef } : {}),
      ...(params.note ? { p_note: params.note } : {}),
    });
    if (error) throw error;
  }

  async findDesignChoices(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingDesignChoice[]> {
    const { data, error } = await this.client
      .from("wedding_design_choices")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .order("slot_key", { ascending: true });
    if (error) throw error;
    return data.map(toDesignChoice);
  }

  /** SECURITY DEFINER RPC (`set_wedding_design_choice`) — re-derives
   * organizer-or-assigned-member authorization server-side and upserts on
   * (party, member-or-null, slot) rather than trusting a client-supplied
   * customer/member id or accumulating duplicate rows per slot. */
  async setDesignChoice(params: {
    weddingPartyId: WeddingPartyId;
    weddingPartyMemberId?: WeddingPartyMemberId;
    slotKey: string;
    valueKey: string;
    coordinated?: boolean;
  }): Promise<void> {
    const { error } = await this.client.rpc("set_wedding_design_choice", {
      p_wedding_party_id: params.weddingPartyId,
      p_slot_key: params.slotKey,
      p_value_key: params.valueKey,
      ...(params.weddingPartyMemberId
        ? { p_wedding_party_member_id: params.weddingPartyMemberId }
        : {}),
      ...(params.coordinated !== undefined
        ? { p_coordinated: params.coordinated }
        : {}),
    });
    if (error) throw error;
  }

  async findDateCandidates(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingDateCandidate[]> {
    const { data, error } = await this.client
      .from("wedding_date_candidates")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .order("candidate_date", { ascending: true });
    if (error) throw error;
    return data.map(toDateCandidate);
  }

  async findDateVotes(
    candidateIds: WeddingDateCandidateId[],
  ): Promise<WeddingDateVote[]> {
    if (candidateIds.length === 0) return [];
    const { data, error } = await this.client
      .from("wedding_date_votes")
      .select("*")
      .in("wedding_date_candidate_id", candidateIds);
    if (error) throw error;
    return data.map(toDateVote);
  }

  /** SECURITY DEFINER RPC (`propose_wedding_date_candidate`) — re-derives
   * organizer/member authorization server-side; idempotent on
   * (party, date) via `on conflict do nothing`. */
  async proposeDateCandidate(
    weddingPartyId: WeddingPartyId,
    candidateDate: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("propose_wedding_date_candidate", {
      p_wedding_party_id: weddingPartyId,
      p_candidate_date: candidateDate,
    });
    if (error) throw error;
  }

  /** SECURITY DEFINER RPC (`toggle_wedding_date_vote`) — resolves the
   * caller's own member row server-side, so a member can never vote as
   * someone else. Returns true if the vote is now cast. */
  async toggleDateVote(candidateId: WeddingDateCandidateId): Promise<boolean> {
    const { data, error } = await this.client.rpc("toggle_wedding_date_vote", {
      p_candidate_id: candidateId,
    });
    if (error) throw error;
    return data;
  }

  async findGuestVouchers(
    weddingPartyId: WeddingPartyId,
  ): Promise<WeddingGuestVoucher[]> {
    const { data, error } = await this.client
      .from("wedding_guest_vouchers")
      .select("*")
      .eq("wedding_party_id", weddingPartyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toGuestVoucher);
  }

  /** Plain insert/update, not an RPC: the caller here is always retailer
   * staff with a real session, so the existing staff RLS policies on
   * `wedding_guest_vouchers` are sufficient — same reasoning as
   * `createGroupFitting`. Records a fact (issued / later redeemed); never
   * moves money itself. */
  async issueGuestVoucher(params: {
    retailerId: RetailerId;
    weddingPartyId: WeddingPartyId;
    guestLabel: string;
    valueMinorUnits: number;
    currency: string;
    fundingSource: string;
    expiresOn: string;
  }): Promise<WeddingGuestVoucher> {
    const { data, error } = await this.client
      .from("wedding_guest_vouchers")
      .insert({
        retailer_id: params.retailerId,
        wedding_party_id: params.weddingPartyId,
        guest_label: params.guestLabel,
        value_minor_units: params.valueMinorUnits,
        currency: params.currency,
        funding_source: params.fundingSource,
        expires_on: params.expiresOn,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toGuestVoucher(data);
  }

  async markGuestVoucherRedeemed(
    voucherId: WeddingGuestVoucherId,
  ): Promise<void> {
    const { error } = await this.client
      .from("wedding_guest_vouchers")
      .update({ redeemed_at: new Date().toISOString() })
      .eq("id", voucherId)
      .is("redeemed_at", null);
    if (error) throw error;
  }

  /** The recipient's party (organizer or any member) redeeming a guest
   * voucher through the customer app. Unlike the plain staff update above,
   * the caller here is never trusted with the party/retailer relationship —
   * `redeem_wedding_guest_voucher` re-derives party membership from
   * `auth.uid()`, locks the row, and enforces the idempotency/expiry rules
   * server-side, so this has nothing further to check. */
  async redeemGuestVoucherAsCustomer(
    voucherId: WeddingGuestVoucherId,
  ): Promise<void> {
    const { error } = await this.client.rpc("redeem_wedding_guest_voucher", {
      p_voucher_id: voucherId,
    });
    if (error) throw error;
  }
}
