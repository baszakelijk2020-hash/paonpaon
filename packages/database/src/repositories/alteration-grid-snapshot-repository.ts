import { asId, type AlterationId, type RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

export interface AlterationGridValue {
  operationId: string;
  value: number;
}

export interface AlterationGridSnapshot {
  id: string;
  retailerId: RetailerId;
  customerId: string;
  alterationId: AlterationId;
  version: number;
  values: AlterationGridValue[];
  comments?: string;
  createdByStaffId?: string;
  createdAt: string;
}

export class AlterationGridSnapshotRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAlteration(
    alterationId: AlterationId,
  ): Promise<AlterationGridSnapshot[]> {
    const { data, error } = await this.client
      .from("alteration_grid_snapshots" as never)
      .select("*" as never)
      .eq("alteration_id" as never, alterationId)
      .order("version" as never, { ascending: false });
    if (error) throw error;
    return (data as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      retailerId: asId<"RetailerId">(String(row.retailer_id)),
      customerId: String(row.customer_id),
      alterationId: asId<"AlterationId">(String(row.alteration_id)),
      version: Number(row.version),
      values: (
        row.values as Array<{ operation_id: string; value: number }>
      ).map((value) => ({
        operationId: value.operation_id,
        value: Number(value.value),
      })),
      ...(row.comments ? { comments: String(row.comments) } : {}),
      ...(row.created_by_staff_id
        ? { createdByStaffId: String(row.created_by_staff_id) }
        : {}),
      createdAt: String(row.created_at),
    }));
  }

  async save(input: {
    alterationId: AlterationId;
    values: AlterationGridValue[];
    comments?: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc(
      "save_alteration_grid_snapshot" as never,
      {
        p_alteration_id: input.alterationId,
        p_values: input.values.map((value) => ({
          operation_id: value.operationId,
          value: value.value,
        })),
        p_comments: input.comments ?? null,
      } as never,
    );
    if (error) throw error;
    return String(data);
  }

  async dispatch(input: {
    snapshotId: string;
    selectedOperationIds: string[];
    comments?: string;
  }): Promise<AlterationId> {
    const { data, error } = await this.client.rpc(
      "dispatch_alteration_grid_snapshot" as never,
      {
        p_snapshot_id: input.snapshotId,
        p_selected_operation_ids: input.selectedOperationIds,
        p_comments: input.comments ?? null,
      } as never,
    );
    if (error) throw error;
    return asId<"AlterationId">(String(data));
  }
}
