import {
  asId,
  type CurrencyCode,
  type GiftCuratedItem,
  type GiftCuratedItemId,
  type GiftExperience,
  type GiftExperienceId,
  type GiftExperienceStatus,
  type GiftInvitation,
  type GiftInvitationId,
  type GiftInvitationStateHistory,
  type GiftInvitationStatus,
  type GiftReveal,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ExperienceRow = Database["public"]["Tables"]["gift_experiences"]["Row"];
type CuratedItemRow = Database["public"]["Tables"]["gift_curated_items"]["Row"];
type InvitationRow = Database["public"]["Tables"]["gift_invitations"]["Row"];
type StateHistoryRow =
  Database["public"]["Tables"]["gift_invitation_state_history"]["Row"];

const toExperience = (row: ExperienceRow): GiftExperience => ({
  id: asId<"GiftExperienceId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  ...(row.created_by_staff_id
    ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
    : {}),
  title: row.title,
  introMessage: row.intro_message,
  status: row.status,
  ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toCuratedItem = (row: CuratedItemRow): GiftCuratedItem => ({
  id: asId<"GiftCuratedItemId">(row.id),
  giftExperienceId: asId<"GiftExperienceId">(row.gift_experience_id),
  productVariantId: asId<"ProductVariantId">(row.product_variant_id),
  ...(row.note ? { note: row.note } : {}),
  sortOrder: row.sort_order,
});

const toInvitation = (row: InvitationRow): GiftInvitation => ({
  id: asId<"GiftInvitationId">(row.id),
  giftExperienceId: asId<"GiftExperienceId">(row.gift_experience_id),
  inviteToken: row.invite_token,
  ...(row.recipient_name ? { recipientName: row.recipient_name } : {}),
  ...(row.recipient_email ? { recipientEmail: row.recipient_email } : {}),
  status: row.status,
  ...(row.opened_at ? { openedAt: row.opened_at } : {}),
  ...(row.redeemed_at ? { redeemedAt: row.redeemed_at } : {}),
  ...(row.redeemed_curated_item_id
    ? {
        redeemedCuratedItemId: asId<"GiftCuratedItemId">(
          row.redeemed_curated_item_id,
        ),
      }
    : {}),
  ...(row.email_sent_at ? { emailSentAt: row.email_sent_at } : {}),
  ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
  ...(row.revoked_at ? { revokedAt: row.revoked_at } : {}),
  ...(row.refund_amount_minor_units != null
    ? { refundAmountMinorUnits: row.refund_amount_minor_units }
    : {}),
  ...(row.refund_reason ? { refundReason: row.refund_reason } : {}),
  createdAt: row.created_at,
});

const toStateHistory = (row: StateHistoryRow): GiftInvitationStateHistory => ({
  id: row.id,
  giftInvitationId: asId<"GiftInvitationId">(row.gift_invitation_id),
  ...(row.from_status ? { fromStatus: row.from_status } : {}),
  toStatus: row.to_status,
  ...(row.reason ? { reason: row.reason } : {}),
  ...(row.refund_amount_minor_units != null
    ? { refundAmountMinorUnits: row.refund_amount_minor_units }
    : {}),
  ...(row.actor_staff_id
    ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
    : {}),
  createdAt: row.created_at,
});

export class GiftRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findExperienceById(
    id: GiftExperienceId,
  ): Promise<GiftExperience | null> {
    const { data, error } = await this.client
      .from("gift_experiences")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toExperience(data) : null;
  }

  async findExperiencesByRetailer(
    retailerId: RetailerId,
  ): Promise<GiftExperience[]> {
    const { data, error } = await this.client
      .from("gift_experiences")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toExperience);
  }

  async createExperience(
    retailerId: RetailerId,
    staffId: StaffId,
    values: {
      title: string;
      introMessage: string;
      expiresAt?: string;
    },
  ): Promise<GiftExperience> {
    const { data, error } = await this.client
      .from("gift_experiences")
      .insert({
        retailer_id: retailerId,
        created_by_staff_id: staffId,
        title: values.title,
        intro_message: values.introMessage,
        status: "active",
        expires_at: values.expiresAt ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toExperience(data);
  }

  async updateExperienceStatus(
    id: GiftExperienceId,
    status: GiftExperienceStatus,
  ): Promise<void> {
    const { error } = await this.client
      .from("gift_experiences")
      .update({ status })
      .eq("id", id);
    if (error) throw error;
  }

  async addCuratedItem(
    giftExperienceId: GiftExperienceId,
    values: {
      productVariantId: string;
      note?: string;
      sortOrder?: number;
    },
  ): Promise<GiftCuratedItem> {
    const { data, error } = await this.client
      .from("gift_curated_items")
      .insert({
        gift_experience_id: giftExperienceId,
        product_variant_id: values.productVariantId,
        note: values.note ?? null,
        sort_order: values.sortOrder ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toCuratedItem(data);
  }

  async findCuratedItems(
    giftExperienceId: GiftExperienceId,
  ): Promise<GiftCuratedItem[]> {
    const { data, error } = await this.client
      .from("gift_curated_items")
      .select("*")
      .eq("gift_experience_id", giftExperienceId)
      .order("sort_order");
    if (error) throw error;
    return data.map(toCuratedItem);
  }

  async createInvitation(
    giftExperienceId: GiftExperienceId,
    staffId: StaffId,
    values: { recipientName?: string; recipientEmail?: string },
  ): Promise<GiftInvitation> {
    const { data, error } = await this.client
      .from("gift_invitations")
      .insert({
        gift_experience_id: giftExperienceId,
        created_by_staff_id: staffId,
        recipient_name: values.recipientName ?? null,
        recipient_email: values.recipientEmail ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toInvitation(data);
  }

  async findInvitationsByExperience(
    giftExperienceId: GiftExperienceId,
  ): Promise<GiftInvitation[]> {
    const { data, error } = await this.client
      .from("gift_invitations")
      .select("*")
      .eq("gift_experience_id", giftExperienceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toInvitation);
  }

  /** Anonymous, opaque-token reveal (`resolve_gift_invitation`, SECURITY
   * DEFINER) — the only way a recipient sees a gift. Opens it on first
   * read; never exposes another recipient's activity. */
  async resolveInvitation(inviteToken: string): Promise<GiftReveal> {
    const { data, error } = await this.client.rpc("resolve_gift_invitation", {
      p_invite_token: inviteToken,
    });
    if (error) throw error;
    const payload = data as unknown as {
      retailerDisplayName: string;
      retailerSlug: string;
      title: string;
      introMessage: string;
      status: GiftInvitation["status"];
      redeemedCuratedItemId: string | null;
      items: readonly {
        curatedItemId: string;
        productVariantId: string;
        productName: string;
        variantLabel: string | null;
        priceAmountMinorUnits: number;
        priceCurrency: string;
        primaryImageUrl: string | null;
        note: string | null;
      }[];
    };
    return {
      retailerDisplayName: payload.retailerDisplayName,
      retailerSlug: payload.retailerSlug,
      title: payload.title,
      introMessage: payload.introMessage,
      status: payload.status,
      ...(payload.redeemedCuratedItemId
        ? {
            redeemedCuratedItemId: asId<"GiftCuratedItemId">(
              payload.redeemedCuratedItemId,
            ),
          }
        : {}),
      items: payload.items.map((item) => ({
        curatedItemId: asId<"GiftCuratedItemId">(item.curatedItemId),
        productVariantId: asId<"ProductVariantId">(item.productVariantId),
        productName: item.productName,
        ...(item.variantLabel ? { variantLabel: item.variantLabel } : {}),
        price: {
          amountMinorUnits: item.priceAmountMinorUnits,
          currency: item.priceCurrency as CurrencyCode,
        },
        ...(item.primaryImageUrl
          ? { primaryImageUrl: item.primaryImageUrl }
          : {}),
        ...(item.note ? { note: item.note } : {}),
      })),
    };
  }

  /** Anonymous, opaque-token redemption (`redeem_gift_invitation`,
   * SECURITY DEFINER). Records the recipient's choice; deliberately does
   * not create an Order or touch stock (see the migration header for
   * why) — the retailer's advisor converts it into a real order/
   * appointment through the existing atomic flows. */
  async redeemInvitation(params: {
    inviteToken: string;
    curatedItemId: GiftCuratedItemId;
    recipientName: string;
    recipientEmail: string;
  }): Promise<GiftCuratedItemId> {
    const { data, error } = await this.client.rpc("redeem_gift_invitation", {
      p_invite_token: params.inviteToken,
      p_curated_item_id: params.curatedItemId,
      p_recipient_name: params.recipientName,
      p_recipient_email: params.recipientEmail,
    });
    if (error) throw error;
    const payload = data as { ok: boolean; curatedItemId: string };
    return asId<"GiftCuratedItemId">(payload.curatedItemId);
  }

  /** Queues the invitation's redeem link through the standard
   * email_outbox drain (`enqueue_gift_invitation_email`, SECURITY
   * DEFINER — re-derives retailer-manager authorization server-side and
   * reads recipient/subject/body from the invitation itself, not from
   * the caller). Returns the queued `email_outbox` row id. */
  async enqueueInvitationEmail(params: {
    invitationId: GiftInvitationId;
    customerAppBaseUrl: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "enqueue_gift_invitation_email",
      {
        p_invitation_id: params.invitationId,
        p_customer_app_base_url: params.customerAppBaseUrl,
      },
    );
    if (error) throw error;
    return data as string;
  }

  /** Idempotent lazy expiry (`expire_gift_invitation`, SECURITY DEFINER).
   * No-ops on any invitation that isn't currently pending/opened past its
   * own or its experience's `expiresAt`; returns the invitation's
   * (possibly unchanged) status. */
  async recordExpiry(
    invitationId: GiftInvitationId,
  ): Promise<GiftInvitationStatus> {
    const { data, error } = await this.client.rpc("expire_gift_invitation", {
      p_invitation_id: invitationId,
    });
    if (error) throw error;
    return data as GiftInvitationStatus;
  }

  /** Retailer-manager-only single-invitation revoke
   * (`revoke_gift_invitation`, SECURITY DEFINER — re-derives manager
   * authorization server-side). Only a still-live (pending/opened)
   * invitation can be revoked; see `canRevoke`. */
  async recordRevocation(
    invitationId: GiftInvitationId,
    reason?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("revoke_gift_invitation", {
      p_invitation_id: invitationId,
      p_reason: reason ?? "",
    });
    if (error) throw error;
  }

  /** Retailer-manager-only refund record (`mark_gift_invitation_refunded`,
   * SECURITY DEFINER — re-derives manager authorization server-side).
   * This records that a refund was decided and executed elsewhere; it
   * does not call a payment processor. Only a redeemed invitation that
   * has not already been refunded can be marked refunded — the database
   * guard (not this method) is what prevents a double refund. */
  async recordRefund(params: {
    invitationId: GiftInvitationId;
    refundAmountMinorUnits: number;
    reason?: string;
  }): Promise<void> {
    const { error } = await this.client.rpc("mark_gift_invitation_refunded", {
      p_invitation_id: params.invitationId,
      p_refund_amount_minor_units: params.refundAmountMinorUnits,
      p_reason: params.reason ?? "",
    });
    if (error) throw error;
  }

  /** Full append-only transition history for one invitation, newest
   * first — retailer staff of the owning retailer only (RLS), never the
   * anonymous recipient. */
  async findStateHistory(
    invitationId: GiftInvitationId,
  ): Promise<GiftInvitationStateHistory[]> {
    const { data, error } = await this.client
      .from("gift_invitation_state_history")
      .select("*")
      .eq("gift_invitation_id", invitationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toStateHistory);
  }
}
