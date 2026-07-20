import {
  asId,
  type RetailerId,
  type StaffId,
  type StaffShift,
  type StaffShiftId,
  type StaffTimeEntry,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ShiftRow = Database["public"]["Tables"]["staff_shifts"]["Row"];
type TimeEntryRow = Database["public"]["Tables"]["staff_time_entries"]["Row"];

const toShift = (row: ShiftRow): StaffShift => ({
  id: asId<"StaffShiftId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  staffId: asId<"StaffId">(row.staff_id),
  shiftDate: row.shift_date,
  startTime: row.start_time,
  endTime: row.end_time,
  ...(row.notes ? { notes: row.notes } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

const toTimeEntry = (row: TimeEntryRow): StaffTimeEntry => ({
  id: asId<"StaffTimeEntryId">(row.id),
  retailerId: asId<"RetailerId">(row.retailer_id),
  staffId: asId<"StaffId">(row.staff_id),
  clockInAt: row.clock_in_at,
  ...(row.clock_out_at ? { clockOutAt: row.clock_out_at } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: null,
});

/** See `docs/ARCHITECTURE.md` "Data access layer" — the only code
 * allowed to query `staff_shifts`/`staff_time_entries`. */
export class StaffRosterRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findShiftsByRetailer(
    retailerId: RetailerId,
    range: { from: string; to: string },
  ): Promise<StaffShift[]> {
    const { data, error } = await this.client
      .from("staff_shifts")
      .select("*")
      .eq("retailer_id", retailerId)
      .gte("shift_date", range.from)
      .lte("shift_date", range.to)
      .is("deleted_at", null)
      .order("shift_date")
      .order("start_time");
    if (error) throw error;
    return data.map(toShift);
  }

  async createShift(params: {
    retailerId: RetailerId;
    staffId: StaffId;
    shiftDate: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }): Promise<StaffShift> {
    const { data, error } = await this.client
      .from("staff_shifts")
      .insert({
        retailer_id: params.retailerId,
        staff_id: params.staffId,
        shift_date: params.shiftDate,
        start_time: params.startTime,
        end_time: params.endTime,
        ...(params.notes ? { notes: params.notes } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toShift(data);
  }

  async deleteShift(id: StaffShiftId): Promise<void> {
    const { error } = await this.client
      .from("staff_shifts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  /** Every entry for one staff member in a date range — used both to
   * render their log and to compute worked hours. */
  async findTimeEntriesByStaff(
    staffId: StaffId,
    range: { from: string; to: string },
  ): Promise<StaffTimeEntry[]> {
    const { data, error } = await this.client
      .from("staff_time_entries")
      .select("*")
      .eq("staff_id", staffId)
      .gte("clock_in_at", range.from)
      .lte("clock_in_at", range.to)
      .order("clock_in_at", { ascending: false });
    if (error) throw error;
    return data.map(toTimeEntry);
  }

  async findOpenTimeEntry(staffId: StaffId): Promise<StaffTimeEntry | null> {
    const { data, error } = await this.client
      .from("staff_time_entries")
      .select("*")
      .eq("staff_id", staffId)
      .is("clock_out_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toTimeEntry(data) : null;
  }

  async findTimeEntriesByRetailer(
    retailerId: RetailerId,
    range: { from: string; to: string },
  ): Promise<StaffTimeEntry[]> {
    const { data, error } = await this.client
      .from("staff_time_entries")
      .select("*")
      .eq("retailer_id", retailerId)
      .gte("clock_in_at", range.from)
      .lte("clock_in_at", range.to)
      .order("clock_in_at", { ascending: false });
    if (error) throw error;
    return data.map(toTimeEntry);
  }

  /** Self-service — `clock_in`/`clock_out` (security definer) derive
   * the caller's own staff_id from auth.uid(), same shape as
   * `update_wedding_party_member_status`'s member self-transition. */
  async clockIn(): Promise<string> {
    const { data, error } = await this.client.rpc("clock_in");
    if (error) throw error;
    return data;
  }

  async clockOut(): Promise<void> {
    const { error } = await this.client.rpc("clock_out");
    if (error) throw error;
  }
}

/** Sum of clocked hours across entries — clamps an entry with no
 * clock-out to "still open" (0 contributed) rather than guessing. */
export function totalHours(entries: readonly StaffTimeEntry[]): number {
  return entries.reduce((total, entry) => {
    if (!entry.clockOutAt) return total;
    const ms =
      new Date(entry.clockOutAt).getTime() -
      new Date(entry.clockInAt).getTime();
    return total + ms / (1000 * 60 * 60);
  }, 0);
}
