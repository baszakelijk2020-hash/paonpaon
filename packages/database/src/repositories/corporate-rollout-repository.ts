import {
  asId,
  checkAssignWearerToDay,
  planNoShowReslot,
  type CorporateProgrammeId,
  type CorporateRolloutDayId,
  type CorporateRolloutSlotId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type DayRow = Database["public"]["Tables"]["corporate_rollout_days"]["Row"];
type SlotRow = Database["public"]["Tables"]["corporate_rollout_slots"]["Row"];

export interface CorporateRolloutDay {
  readonly id: CorporateRolloutDayId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly fittingDate: string;
  readonly capacity: number;
  readonly advisorNote?: string;
}

export type CorporateRolloutSlotStatus = "planned" | "completed" | "no_show";

export interface CorporateRolloutSlot {
  readonly id: CorporateRolloutSlotId;
  readonly retailerId: RetailerId;
  readonly rolloutDayId: CorporateRolloutDayId;
  readonly wearerId: string;
  readonly status: CorporateRolloutSlotStatus;
}

function toDay(row: DayRow): CorporateRolloutDay {
  return {
    id: asId<"CorporateRolloutDayId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    programmeId: asId<"CorporateProgrammeId">(row.programme_id),
    fittingDate: row.fitting_date,
    capacity: row.capacity,
    ...(row.advisor_note ? { advisorNote: row.advisor_note } : {}),
  };
}

function toSlot(row: SlotRow): CorporateRolloutSlot {
  return {
    id: asId<"CorporateRolloutSlotId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    rolloutDayId: asId<"CorporateRolloutDayId">(row.rollout_day_id),
    wearerId: row.wearer_id,
    status: row.status as CorporateRolloutSlotStatus,
  };
}

export type AssignWearerResult =
  | { readonly ok: true; readonly slot: CorporateRolloutSlot }
  | { readonly ok: false; readonly reason: "day_at_capacity" };

export type ReslotNoShowResult =
  | { readonly ok: true; readonly slot: CorporateRolloutSlot }
  | { readonly ok: false; readonly reason: "no_capacity_available" };

/**
 * Measurement/fitting rollout planning (PHASE 18.6 / BD-106). Capacity
 * is enforced twice: `checkAssignWearerToDay` here, before the insert,
 * and `corporate_rollout_slots_wearer_active_unique` at the database —
 * the check alone would still race under concurrent assignment, the
 * unique index is what actually prevents a wearer from ending up with
 * two live slots.
 */
export class CorporateRolloutRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findDaysByProgramme(
    programmeId: CorporateProgrammeId,
  ): Promise<readonly CorporateRolloutDay[]> {
    const { data, error } = await this.client
      .from("corporate_rollout_days")
      .select("*")
      .eq("programme_id", programmeId)
      .order("fitting_date", { ascending: true });
    if (error) throw error;
    return data.map(toDay);
  }

  async findSlotsByProgramme(
    programmeId: CorporateProgrammeId,
  ): Promise<readonly CorporateRolloutSlot[]> {
    const days = await this.findDaysByProgramme(programmeId);
    if (days.length === 0) return [];
    const { data, error } = await this.client
      .from("corporate_rollout_slots")
      .select("*")
      .in(
        "rollout_day_id",
        days.map((d) => d.id),
      );
    if (error) throw error;
    return data.map(toSlot);
  }

  async createDay(args: {
    readonly retailerId: RetailerId;
    readonly programmeId: CorporateProgrammeId;
    readonly fittingDate: string;
    readonly capacity: number;
    readonly advisorNote?: string;
  }): Promise<CorporateRolloutDay> {
    const { data, error } = await this.client
      .from("corporate_rollout_days")
      .insert({
        retailer_id: args.retailerId,
        programme_id: args.programmeId,
        fitting_date: args.fittingDate,
        capacity: args.capacity,
        ...(args.advisorNote ? { advisor_note: args.advisorNote } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return toDay(data);
  }

  private async countPlanned(dayId: CorporateRolloutDayId): Promise<number> {
    const { count, error } = await this.client
      .from("corporate_rollout_slots")
      .select("*", { count: "exact", head: true })
      .eq("rollout_day_id", dayId)
      .eq("status", "planned");
    if (error) throw error;
    return count ?? 0;
  }

  async assignWearer(args: {
    readonly retailerId: RetailerId;
    readonly rolloutDayId: CorporateRolloutDayId;
    readonly wearerId: string;
    readonly capacity: number;
  }): Promise<AssignWearerResult> {
    const currentlyAssignedCount = await this.countPlanned(args.rolloutDayId);
    const check = checkAssignWearerToDay({
      currentlyAssignedCount,
      capacity: args.capacity,
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("corporate_rollout_slots")
      .insert({
        retailer_id: args.retailerId,
        rollout_day_id: args.rolloutDayId,
        wearer_id: args.wearerId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, slot: toSlot(data) };
  }

  async markCompleted(slotId: CorporateRolloutSlotId): Promise<void> {
    const { error } = await this.client
      .from("corporate_rollout_slots")
      .update({ status: "completed" })
      .eq("id", slotId);
    if (error) throw error;
  }

  /** Marks the slot a no-show, then immediately tries to reslot the
   * wearer onto the earliest day in the SAME programme with spare
   * capacity — a no-show must never silently drop them from the
   * rollout. Returns the new slot on success; the original row stays
   * `no_show`, never edited into the new one. */
  async markNoShowAndReslot(args: {
    readonly retailerId: RetailerId;
    readonly slotId: CorporateRolloutSlotId;
    readonly programmeId: CorporateProgrammeId;
  }): Promise<ReslotNoShowResult> {
    const { data: current, error: findError } = await this.client
      .from("corporate_rollout_slots")
      .select("wearer_id")
      .eq("id", args.slotId)
      .single();
    if (findError) throw findError;

    const { error: updateError } = await this.client
      .from("corporate_rollout_slots")
      .update({ status: "no_show" })
      .eq("id", args.slotId);
    if (updateError) throw updateError;

    const days = await this.findDaysByProgramme(args.programmeId);
    const candidateDays = await Promise.all(
      days.map(async (day) => ({
        rolloutDayId: day.id,
        fittingDate: day.fittingDate,
        currentlyAssignedCount: await this.countPlanned(day.id),
        capacity: day.capacity,
      })),
    );
    const plan = planNoShowReslot({ candidateDays });
    if (!plan.ok) return plan;

    const { data, error } = await this.client
      .from("corporate_rollout_slots")
      .insert({
        retailer_id: args.retailerId,
        rollout_day_id: plan.rolloutDayId,
        wearer_id: current.wearer_id,
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, slot: toSlot(data) };
  }
}
