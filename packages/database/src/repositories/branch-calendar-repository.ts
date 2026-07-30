/**
 * Branch calendar repository (CLI-006 / PHASE 7.5).
 */

import {
  asId,
  branchLocalDayUtcBounds,
  type BranchCalendarEntry,
  type BranchCalendarEntryType,
  type BranchCalendarRecurrence,
  type BranchCalendarEntryId,
  type BranchId,
  type CustomerId,
  type RetailerBranch,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type BranchRow = Database["public"]["Tables"]["retailer_branches"]["Row"];
type EntryRow = Database["public"]["Tables"]["branch_calendar_entries"]["Row"];

function toBranch(row: BranchRow): RetailerBranch {
  return {
    id: asId<"BranchId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    name: row.name,
    timezone: row.timezone,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toEntry(row: EntryRow): BranchCalendarEntry {
  return {
    id: asId<"BranchCalendarEntryId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    branchId: asId<"BranchId">(row.branch_id),
    entryType: row.entry_type as BranchCalendarEntryType,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    recurrence: row.recurrence as BranchCalendarRecurrence,
    assignedStaffIds: (row.assigned_staff_ids ?? []).map((id) =>
      asId<"StaffId">(id),
    ),
    ...(row.customer_id
      ? { customerId: asId<"CustomerId">(row.customer_id) }
      : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class BranchCalendarRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listBranches(retailerId: RetailerId): Promise<RetailerBranch[]> {
    const { data, error } = await this.client
      .from("retailer_branches")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("is_primary", { ascending: false })
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map(toBranch);
  }

  async createBranch(args: {
    readonly retailerId: RetailerId;
    readonly name: string;
    readonly timezone: string;
    readonly isPrimary?: boolean;
  }): Promise<RetailerBranch> {
    const { data, error } = await this.client
      .from("retailer_branches")
      .insert({
        retailer_id: args.retailerId,
        name: args.name.trim(),
        timezone: args.timezone.trim(),
        is_primary: args.isPrimary ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toBranch(data);
  }

  async listEntriesForBranch(args: {
    readonly branchId: BranchId;
    readonly localDate: string;
    readonly timezone: string;
  }): Promise<BranchCalendarEntry[]> {
    const bounds = branchLocalDayUtcBounds({
      localDate: args.localDate,
      timezone: args.timezone,
    });
    const { data, error } = await this.client
      .from("branch_calendar_entries")
      .select("*")
      .eq("branch_id", args.branchId)
      .is("deleted_at", null)
      .gte("starts_at", bounds.startUtc)
      .lte("starts_at", bounds.endUtc)
      .order("starts_at", { ascending: true });
    if (error) throw error;
    return data.map(toEntry);
  }

  async listEntriesByRetailer(
    retailerId: RetailerId,
    limit = 100,
  ): Promise<BranchCalendarEntry[]> {
    const { data, error } = await this.client
      .from("branch_calendar_entries")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data.map(toEntry);
  }

  async createEntry(args: {
    readonly retailerId: RetailerId;
    readonly branchId: BranchId;
    readonly entryType: BranchCalendarEntryType;
    readonly title: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly recurrence?: BranchCalendarRecurrence;
    readonly assignedStaffIds?: readonly StaffId[];
    readonly customerId?: CustomerId;
    readonly notes?: string;
    readonly createdByStaffId?: StaffId;
  }): Promise<BranchCalendarEntry> {
    const { data, error } = await this.client
      .from("branch_calendar_entries")
      .insert({
        retailer_id: args.retailerId,
        branch_id: args.branchId,
        entry_type: args.entryType,
        title: args.title.trim(),
        starts_at: args.startsAt,
        ends_at: args.endsAt,
        recurrence: args.recurrence ?? "none",
        assigned_staff_ids: [...(args.assignedStaffIds ?? [])],
        customer_id: args.customerId ?? null,
        notes: args.notes ?? null,
        created_by_staff_id: args.createdByStaffId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toEntry(data);
  }

  async softDeleteEntry(entryId: BranchCalendarEntryId): Promise<void> {
    const { error } = await this.client
      .from("branch_calendar_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", entryId);
    if (error) throw error;
  }
}
