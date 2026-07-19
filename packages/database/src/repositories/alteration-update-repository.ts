import {
  asId,
  type AlterationId,
  type AlterationStatus,
  type AlterationUpdate,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AlterationUpdateRow =
  Database["public"]["Tables"]["alteration_updates"]["Row"];

function toDomain(row: AlterationUpdateRow): AlterationUpdate {
  return {
    id: asId<"AlterationUpdateId">(row.id),
    alterationId: asId<"AlterationId">(row.alteration_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    status: row.status,
    ...(row.note ? { note: row.note } : {}),
    ...(row.staff_id ? { staffId: asId<"StaffId">(row.staff_id) } : {}),
    createdAt: row.created_at,
  };
}

export interface AddAlterationUpdateParams {
  alterationId: AlterationId;
  retailerId: RetailerId;
  status: AlterationStatus;
  note?: string;
  staffId?: StaffId;
}

/**
 * The only way an `Alteration`'s status moves — `add()` inserting here
 * is what the `sync_alteration_status_on_update_insert` trigger uses to
 * keep `alterations.status` in sync. See docs/DECISIONS.md ADR-015.
 */
export class AlterationUpdateRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAlteration(
    alterationId: AlterationId,
  ): Promise<AlterationUpdate[]> {
    const { data, error } = await this.client
      .from("alteration_updates")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async add(params: AddAlterationUpdateParams): Promise<AlterationUpdate> {
    const { data, error } = await this.client
      .from("alteration_updates")
      .insert({
        alteration_id: params.alterationId,
        retailer_id: params.retailerId,
        status: params.status,
        note: params.note ?? null,
        staff_id: params.staffId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }
}
