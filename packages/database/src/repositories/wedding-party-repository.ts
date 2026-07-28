import {
  asId,
  type CustomerId,
  type RetailerId,
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

  /** The anonymous join path (`join_wedding_party`, security definer)
   * — no pre-validation read of the invite token beforehand, since
   * `wedding_parties`' RLS has no anonymous select policy and never
   * should (ADR-034's "no new anonymous RLS read/insert policy, narrow
   * RPC only"). An invalid token surfaces as a thrown error here. */
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
}
