import {
  asId,
  type CustomerFitProfileEntry,
  type CustomerId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type FitProfileEntryRow =
  Database["public"]["Tables"]["customer_fit_profile_entries"]["Row"];

function toDomain(row: FitProfileEntryRow): CustomerFitProfileEntry {
  return {
    id: asId<"CustomerFitProfileEntryId">(row.id),
    customerId: asId<"CustomerId">(row.customer_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    measurements: row.measurements as unknown as Record<string, string>,
    ...(row.fit_preferences ? { fitPreferences: row.fit_preferences } : {}),
    ...(row.style_notes ? { styleNotes: row.style_notes } : {}),
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
    recordedAt: row.recorded_at,
  };
}

export interface AddFitProfileEntryParams {
  customerId: CustomerId;
  retailerId: RetailerId;
  measurements: Record<string, string>;
  fitPreferences?: string;
  styleNotes?: string;
  recordedByStaffId?: StaffId;
}

/**
 * Append-only — see docs/DECISIONS.md ADR-015. There is no `update`
 * method: recording a correction is a new entry, not an edit of a past
 * one.
 */
export class CustomerFitProfileRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Every recorded entry for this customer, most recent first. */
  async findHistory(
    customerId: CustomerId,
  ): Promise<CustomerFitProfileEntry[]> {
    const { data, error } = await this.client
      .from("customer_fit_profile_entries")
      .select("*")
      .eq("customer_id", customerId)
      .order("recorded_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  /** The most recent entry — "current" fit profile. */
  async findCurrent(
    customerId: CustomerId,
  ): Promise<CustomerFitProfileEntry | null> {
    const { data, error } = await this.client
      .from("customer_fit_profile_entries")
      .select("*")
      .eq("customer_id", customerId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async add(
    params: AddFitProfileEntryParams,
  ): Promise<CustomerFitProfileEntry> {
    const { data, error } = await this.client
      .from("customer_fit_profile_entries")
      .insert({
        customer_id: params.customerId,
        retailer_id: params.retailerId,
        measurements: params.measurements,
        fit_preferences: params.fitPreferences ?? null,
        style_notes: params.styleNotes ?? null,
        recorded_by_staff_id: params.recordedByStaffId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }
}
