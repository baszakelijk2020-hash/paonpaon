import {
  asId,
  type AlterationId,
  type AlterationStatus,
  type AlterationUpdate,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

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
        p_note: params.note ?? null,
        p_customer_visible: params.customerVisible ?? false,
      },
    );
    if (error) throw error;
  }
}
