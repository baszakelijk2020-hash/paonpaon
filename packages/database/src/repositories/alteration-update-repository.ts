import {
  ALTERATION_STATUS_LABELS,
  asId,
  type AlterationId,
  type AlterationStatus,
  type AlterationUpdate,
  type CustomerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { MessagingRepository } from "./messaging-repository";

type HistoryRow =
  Database["public"]["Tables"]["alteration_status_history"]["Row"];

function toDomain(row: HistoryRow): AlterationUpdate {
  return {
    id: asId<"AlterationStatusHistoryId">(row.id),
    alterationId: asId<"AlterationId">(row.alteration_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.from_status ? { fromStatus: row.from_status } : {}),
    toStatus: row.to_status,
    ...(row.note ? { note: row.note } : {}),
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    ...(row.actor_user_id ? { actorUserId: row.actor_user_id } : {}),
    customerVisible: row.customer_visible,
    createdAt: row.created_at,
  };
}

export class AlterationUpdateRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAlteration(
    alterationId: AlterationId,
  ): Promise<AlterationUpdate[]> {
    const { data, error } = await this.client
      .from("alteration_status_history")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toDomain);
  }

  async transition(params: {
    alterationId: AlterationId;
    toStatus: AlterationStatus;
    note?: string;
    customerVisible?: boolean;
  }): Promise<void> {
    const { error } = await this.client.rpc(
      "transition_alteration_work_order",
      {
        p_alteration_id: params.alterationId,
        p_to_status: params.toStatus,
        p_note: (params.note ?? null) as never,
        p_customer_visible: params.customerVisible ?? false,
      },
    );
    if (error) throw error;
  }

  /**
   * Threads a customer-visible status update into the Communication
   * Centre (the customer's existing conversation with this retailer,
   * created if none exists yet) and stamps `customer_notified_at`.
   * Staff-role gated by the same reused `get_or_create_staff_conversation`
   * RPC every other staff-to-customer message already goes through — a
   * role this codebase does not let message customers (worker,
   * workshop_manager, production_staff) fails that RPC and this method
   * quietly no-ops rather than blocking the status transition itself,
   * which has already succeeded by the time this runs.
   */
  async notifyCustomer(params: {
    alterationId: AlterationId;
    toStatus: AlterationStatus;
    note?: string;
  }): Promise<{ notified: boolean }> {
    const { data: workOrder, error } = await this.client
      .from("alteration_work_orders")
      .select("customer_id, work_order_number")
      .eq("id", params.alterationId)
      .single();
    if (error || !workOrder) return { notified: false };

    const messagingRepo = new MessagingRepository(this.client);
    let conversationId;
    try {
      conversationId = await messagingRepo.getOrCreateForStaff(
        workOrder.customer_id as CustomerId,
      );
    } catch {
      return { notified: false };
    }

    const statusLabel = ALTERATION_STATUS_LABELS[params.toStatus];
    const body = [
      `Update on your alteration (${workOrder.work_order_number}): ${statusLabel}.`,
      params.note?.trim() ? params.note.trim() : null,
    ]
      .filter(Boolean)
      .join(" ");

    await messagingRepo.send(conversationId, body);

    const { error: notifyError } = await this.client.rpc(
      "mark_alteration_customer_notified",
      { p_alteration_id: params.alterationId },
    );
    if (notifyError) throw notifyError;

    return { notified: true };
  }
}
