import { asId, type RetailerBranchId, type RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AppointmentClosureRow =
  Database["public"]["Tables"]["appointment_closures"]["Row"];

/**
 * A date-specific period when a branch (or the whole retailer) takes no
 * appointments. `availability_windows` is recurring weekly and
 * `retailer_branches.opening_hours` is a static week, so neither can express
 * "closed on the 26th" or "blocked 14:00-16:00 for a private fitting" — this
 * is that layer. `appointment_slot_conflict()` reads it on every booking and
 * reschedule.
 */
export interface AppointmentClosure {
  id: string;
  retailerId: RetailerId;
  /** Null closes every branch of the retailer for the window. */
  branchId: RetailerBranchId | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

function toDomain(row: AppointmentClosureRow): AppointmentClosure {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    branchId: row.branch_id ? asId<"RetailerBranchId">(row.branch_id) : null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
  };
}

export interface CreateAppointmentClosureParams {
  retailerId: RetailerId;
  branchId?: RetailerBranchId | null;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

export class AppointmentClosureRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Upcoming and in-progress closures, soonest first. Past ones are noise. */
  async findUpcomingByRetailer(
    retailerId: RetailerId,
  ): Promise<AppointmentClosure[]> {
    const { data, error } = await this.client
      .from("appointment_closures")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(
    params: CreateAppointmentClosureParams,
  ): Promise<AppointmentClosure> {
    const { data, error } = await this.client
      .from("appointment_closures")
      .insert({
        retailer_id: params.retailerId,
        branch_id: params.branchId ?? null,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        reason: params.reason ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  /**
   * Soft delete, matching every other table here: a closure that was in force
   * when an appointment was refused is part of the record of why.
   */
  async remove(id: string): Promise<void> {
    const { error } = await this.client
      .from("appointment_closures")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw error;
    }
  }
}
