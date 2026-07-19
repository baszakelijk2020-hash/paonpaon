import {
  asId,
  type AvailabilityWindow,
  type AvailabilityWindowId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AvailabilityWindowRow =
  Database["public"]["Tables"]["availability_windows"]["Row"];

function toDomain(row: AvailabilityWindowRow): AvailabilityWindow {
  return {
    id: asId<"AvailabilityWindowId">(row.id),
    staffId: asId<"StaffId">(row.staff_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    dayOfWeek: row.day_of_week as AvailabilityWindow["dayOfWeek"],
    startTime: row.start_time,
    endTime: row.end_time,
  };
}

export interface CreateAvailabilityWindowParams {
  staffId: StaffId;
  retailerId: RetailerId;
  dayOfWeek: AvailabilityWindow["dayOfWeek"];
  startTime: string;
  endTime: string;
}

export class AvailabilityWindowRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(retailerId: RetailerId): Promise<AvailabilityWindow[]> {
    const { data, error } = await this.client
      .from("availability_windows")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("day_of_week", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async findByStaff(staffId: StaffId): Promise<AvailabilityWindow[]> {
    const { data, error } = await this.client
      .from("availability_windows")
      .select("*")
      .eq("staff_id", staffId)
      .order("day_of_week", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(
    params: CreateAvailabilityWindowParams,
  ): Promise<AvailabilityWindow> {
    const { data, error } = await this.client
      .from("availability_windows")
      .insert({
        staff_id: params.staffId,
        retailer_id: params.retailerId,
        day_of_week: params.dayOfWeek,
        start_time: params.startTime,
        end_time: params.endTime,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  async delete(id: AvailabilityWindowId): Promise<void> {
    const { error } = await this.client
      .from("availability_windows")
      .delete()
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
}
