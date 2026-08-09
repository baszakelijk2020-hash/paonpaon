import {
  asId,
  checkAssignWearerToDay,
  planNoShowReslot,
  type CorporateAccountId,
  type CorporateProgrammeId,
  type CorporateRolloutDayId,
  type CorporateRolloutSlotId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CorporateProjectRepository } from "./corporate-project-repository";

type DayRow = Database["public"]["Tables"]["corporate_rollout_days"]["Row"];
type SlotRow = Database["public"]["Tables"]["corporate_rollout_slots"]["Row"];

export interface CorporateRolloutDay {
  readonly id: CorporateRolloutDayId;
  readonly retailerId: RetailerId;
  readonly programmeId: CorporateProgrammeId;
  readonly fittingDate: string;
  readonly capacity: number;
  readonly advisorNote?: string;
  /** Company-wide (any wearer may be assigned) when unset — see
   * `checkAssignWearerToDay` (PHASE 18.6). */
  readonly siteKey?: string;
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
    ...(row.site_key ? { siteKey: row.site_key } : {}),
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
  | {
      readonly ok: false;
      readonly reason: "day_at_capacity" | "site_mismatch";
    };

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
    readonly siteKey?: string;
  }): Promise<CorporateRolloutDay> {
    const { data, error } = await this.client
      .from("corporate_rollout_days")
      .insert({
        retailer_id: args.retailerId,
        programme_id: args.programmeId,
        fitting_date: args.fittingDate,
        capacity: args.capacity,
        ...(args.advisorNote ? { advisor_note: args.advisorNote } : {}),
        ...(args.siteKey ? { site_key: args.siteKey } : {}),
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

  /** A rollout day belongs to a programme, not directly to the account
   * the project lifecycle (18.7) tracks — this is the one join between
   * them, used only by the auto-advance calls below. */
  private async findProgrammeAccountId(
    programmeId: CorporateProgrammeId,
  ): Promise<CorporateAccountId | null> {
    const { data, error } = await this.client
      .from("corporate_programmes")
      .select("account_id")
      .eq("id", programmeId)
      .maybeSingle();
    if (error) throw error;
    return data ? asId<"CorporateAccountId">(data.account_id) : null;
  }

  /** Counts every slot still `planned` for the whole programme (across
   * all its rollout days), not just one day — the real-world signal for
   * "is anyone still waiting to be fitted at all." */
  private async countPlannedForProgramme(
    programmeId: CorporateProgrammeId,
  ): Promise<number> {
    const days = await this.findDaysByProgramme(programmeId);
    if (days.length === 0) return 0;
    const { count, error } = await this.client
      .from("corporate_rollout_slots")
      .select("*", { count: "exact", head: true })
      .in(
        "rollout_day_id",
        days.map((d) => d.id),
      )
      .eq("status", "planned");
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * PHASE 18.7's own named gap: the project lifecycle's `fitting`
   * checkpoint had no automatic trigger from 18.6's real rollout
   * events, only a staff button. `advanceStageForAccount` already
   * no-ops silently when the project isn't at the one legal
   * predecessor stage (`employee_import`), matching the exact
   * "call unconditionally, let the state machine decide" discipline
   * `corporate-tender-repository.ts`'s own `opportunity -> tender`
   * trigger already established — so every call site below fires this
   * on every relevant event rather than re-deriving "was this the
   * first one" itself.
   */
  private async advanceToFittingIfDue(
    retailerId: RetailerId,
    programmeId: CorporateProgrammeId,
  ): Promise<void> {
    const accountId = await this.findProgrammeAccountId(programmeId);
    if (!accountId) return;
    await new CorporateProjectRepository(this.client).advanceStageForAccount({
      retailerId,
      accountId,
      to: "fitting",
    });
  }

  /** The other half of 18.7's gap: once every planned slot for the
   * programme has actually been completed (fitted), the project moves
   * on to `production` — checked, not assumed, by re-counting after the
   * write rather than trusting that this call is the last one. A wearer
   * whose no-show could never be reslotted (see `markNoShowAndReslot`)
   * stays `no_show` forever with no fresh `planned` row, so a programme
   * with an unresolved no-show never falsely reaches "everyone fitted"
   * — the honest behaviour, not a fabricated completion. */
  private async advanceToProductionIfDue(
    retailerId: RetailerId,
    programmeId: CorporateProgrammeId,
  ): Promise<void> {
    const remaining = await this.countPlannedForProgramme(programmeId);
    if (remaining > 0) return;
    const accountId = await this.findProgrammeAccountId(programmeId);
    if (!accountId) return;
    await new CorporateProjectRepository(this.client).advanceStageForAccount({
      retailerId,
      accountId,
      to: "production",
    });
  }

  async assignWearer(args: {
    readonly retailerId: RetailerId;
    readonly programmeId: CorporateProgrammeId;
    readonly rolloutDayId: CorporateRolloutDayId;
    readonly wearerId: string;
    readonly capacity: number;
    readonly daySiteKey?: string;
    readonly wearerSiteKey?: string;
  }): Promise<AssignWearerResult> {
    const currentlyAssignedCount = await this.countPlanned(args.rolloutDayId);
    const check = checkAssignWearerToDay({
      currentlyAssignedCount,
      capacity: args.capacity,
      ...(args.daySiteKey ? { daySiteKey: args.daySiteKey } : {}),
      ...(args.wearerSiteKey ? { wearerSiteKey: args.wearerSiteKey } : {}),
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
    await this.advanceToFittingIfDue(args.retailerId, args.programmeId);
    return { ok: true, slot: toSlot(data) };
  }

  async markCompleted(args: {
    readonly retailerId: RetailerId;
    readonly programmeId: CorporateProgrammeId;
    readonly slotId: CorporateRolloutSlotId;
  }): Promise<void> {
    const { error } = await this.client
      .from("corporate_rollout_slots")
      .update({ status: "completed" })
      .eq("id", args.slotId);
    if (error) throw error;
    await this.advanceToProductionIfDue(args.retailerId, args.programmeId);
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

    const { data: wearer, error: wearerError } = await this.client
      .from("corporate_wearers")
      .select("site_key")
      .eq("id", current.wearer_id)
      .single();
    if (wearerError) throw wearerError;

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
        ...(day.siteKey ? { siteKey: day.siteKey } : {}),
      })),
    );
    const plan = planNoShowReslot({
      candidateDays,
      ...(wearer.site_key ? { wearerSiteKey: wearer.site_key } : {}),
    });
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
