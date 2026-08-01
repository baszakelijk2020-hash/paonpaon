/**
 * Coverage planning, availability and shift swaps (WFM-105 / PHASE 11.3).
 *
 * This repository never writes `staff_shifts`. A coverage plan states what
 * the day needs; a manager closes the gap by rostering someone. Keeping the
 * write boundary here is what makes "no fully autonomous scheduling"
 * checkable rather than aspirational.
 */

import {
  asId,
  checkSwapApproval,
  checkSwapRequest,
  recommendCoverage,
  type CoverageInterval,
  type CoveragePlan,
  type RetailerId,
  type ScheduledShift,
  type StaffingCitation,
  type StaffingRecommendation,
  type SwapCheck,
  type SwapState,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PlanRow = Database["public"]["Tables"]["coverage_plans"]["Row"];
type IntervalRow =
  Database["public"]["Tables"]["coverage_plan_intervals"]["Row"];
type SwapRow = Database["public"]["Tables"]["staff_shift_swap_requests"]["Row"];

export interface CoveragePlanWithIntervals extends CoveragePlan {
  readonly id: string;
  readonly branchId?: string;
}

function toInterval(row: IntervalRow): CoverageInterval {
  return {
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    requiredHeadcount: row.required_headcount,
    ...(row.required_skills.length > 0
      ? { requiredSkills: row.required_skills }
      : {}),
  };
}

export class CoveragePlanningRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findPlanForDate(args: {
    readonly retailerId: RetailerId;
    readonly planDate: string;
    readonly branchId?: string;
  }): Promise<CoveragePlanWithIntervals | null> {
    let query = this.client
      .from("coverage_plans")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("plan_date", args.planDate)
      .is("deleted_at", null);
    query = args.branchId
      ? query.eq("branch_id", args.branchId)
      : query.is("branch_id", null);

    const { data: plan, error } = await query.maybeSingle();
    if (error) throw error;
    if (!plan) return null;

    const { data: intervals, error: intervalError } = await this.client
      .from("coverage_plan_intervals")
      .select("*")
      .eq("plan_id", plan.id)
      .order("start_time", { ascending: true });
    if (intervalError) throw intervalError;

    return this.toPlan(plan, intervals ?? []);
  }

  private toPlan(
    plan: PlanRow,
    intervals: readonly IntervalRow[],
  ): CoveragePlanWithIntervals {
    return {
      id: plan.id,
      retailerId: plan.retailer_id,
      ...(plan.branch_id ? { branchId: plan.branch_id } : {}),
      planDate: plan.plan_date,
      timezone: plan.timezone,
      state: plan.state === "published" ? "published" : "draft",
      intervals: intervals.map(toInterval),
    };
  }

  /**
   * Creates or replaces a draft plan's intervals. Replacement is a delete
   * plus insert rather than an upsert because an interval that was removed
   * from the plan must actually disappear — an upsert would silently leave
   * yesterday's 18:00–20:00 requirement in place.
   */
  async saveDraftPlan(args: {
    readonly retailerId: RetailerId;
    readonly planDate: string;
    readonly timezone: string;
    readonly intervals: readonly CoverageInterval[];
    readonly branchId?: string;
  }): Promise<CoveragePlanWithIntervals> {
    const { data: plan, error } = await this.client
      .from("coverage_plans")
      .upsert(
        {
          retailer_id: args.retailerId,
          plan_date: args.planDate,
          timezone: args.timezone,
          state: "draft",
          branch_id: args.branchId ?? null,
          // Clearing these is not optional. Re-saving an ALREADY PUBLISHED
          // plan reverts it to draft, and `coverage_plans_publish_complete`
          // asserts that a published state and a publisher exist together
          // or not at all. Leaving them set makes the whole upsert fail
          // with 23514 — which is the constraint doing its job: a row
          // calling itself a draft while naming who published it is
          // incoherent, and the fix belongs here rather than in the
          // constraint. Found by publishing twice through the real UI.
          published_at: null,
          published_by_staff_id: null,
        },
        { onConflict: "retailer_id,branch_id,plan_date" },
      )
      .select("*")
      .single();
    if (error) throw error;

    const { error: deleteError } = await this.client
      .from("coverage_plan_intervals")
      .delete()
      .eq("plan_id", plan.id);
    if (deleteError) throw deleteError;

    if (args.intervals.length === 0) return this.toPlan(plan, []);

    const { data: inserted, error: insertError } = await this.client
      .from("coverage_plan_intervals")
      .insert(
        args.intervals.map((interval) => ({
          retailer_id: args.retailerId,
          plan_id: plan.id,
          start_time: interval.startTime,
          end_time: interval.endTime,
          required_headcount: interval.requiredHeadcount,
          required_skills: [...(interval.requiredSkills ?? [])],
        })),
      )
      .select("*");
    if (insertError) throw insertError;

    return this.toPlan(plan, inserted ?? []);
  }

  async publishPlan(args: {
    readonly retailerId: RetailerId;
    readonly planId: string;
    readonly publishedByStaffId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("coverage_plans")
      .update({
        state: "published",
        published_at: new Date().toISOString(),
        published_by_staff_id: args.publishedByStaffId,
      })
      .eq("id", args.planId)
      .eq("retailer_id", args.retailerId);
    if (error) throw error;
  }

  /**
   * Reads the real roster and the real appointment book, then asks the pure
   * domain recommender for gaps. Appointment counts become citations, so a
   * shortage the manager sees is traceable back to the bookings that caused
   * it rather than to an opaque score.
   */
  async recommendForDate(args: {
    readonly retailerId: RetailerId;
    readonly planDate: string;
    readonly branchId?: string;
  }): Promise<readonly StaffingRecommendation[]> {
    const plan = await this.findPlanForDate(args);
    if (!plan) return [];

    const { data: shiftRows, error } = await this.client
      .from("staff_shifts")
      .select("id, staff_id, start_time, end_time")
      .eq("retailer_id", args.retailerId)
      .eq("shift_date", args.planDate)
      .is("deleted_at", null);
    if (error) throw error;

    const shifts: ScheduledShift[] = (shiftRows ?? []).map((row) => ({
      staffId: row.staff_id,
      startTime: row.start_time.slice(0, 5),
      endTime: row.end_time.slice(0, 5),
      sourceRef: `staff_shifts:${row.id}`,
    }));

    const { data: appointments, error: appointmentError } = await this.client
      .from("appointments")
      .select("id, starts_at")
      .eq("retailer_id", args.retailerId)
      .gte("starts_at", `${args.planDate}T00:00:00.000Z`)
      .lte("starts_at", `${args.planDate}T23:59:59.999Z`)
      .is("deleted_at", null);
    if (appointmentError) throw appointmentError;

    const demandCitations: StaffingCitation[] = [];
    const byHour = new Map<string, number>();
    for (const appointment of appointments ?? []) {
      const hour = appointment.starts_at.slice(11, 13);
      byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    }
    for (const [hour, count] of [...byHour.entries()].sort()) {
      demandCitations.push({
        kind: "booked_appointments",
        observedValue: count,
        sourceRef: `appointments:${args.planDate}T${hour}`,
        windowStart: `${hour}:00`,
        windowEnd: `${String(Number(hour) + 1).padStart(2, "0")}:00`,
      });
    }

    return recommendCoverage({ plan, shifts, demandCitations });
  }

  async declareAvailability(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly effectiveOn: string;
    readonly weekday: number;
    readonly startTime: string;
    readonly endTime: string;
    readonly available: boolean;
    readonly note?: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("staff_availability_declarations")
      .insert({
        retailer_id: args.retailerId,
        staff_id: args.staffId,
        effective_on: args.effectiveOn,
        weekday: args.weekday,
        start_time: args.startTime,
        end_time: args.endTime,
        available: args.available,
        ...(args.note ? { note: args.note } : {}),
      });
    if (error) throw error;
  }

  /**
   * Opens a swap. Reads the shift, the peer's declared availability and the
   * peer's existing roster first, so the refusal reasons are computed
   * against current state rather than whatever the UI last rendered.
   */
  async requestSwap(args: {
    readonly retailerId: RetailerId;
    readonly shiftId: string;
    readonly requestingStaffId: string;
    readonly peerStaffId: string;
    readonly reason?: string;
  }): Promise<{ readonly ok: true; readonly id: string } | SwapCheck> {
    const { data: shift, error } = await this.client
      .from("staff_shifts")
      .select("id, staff_id, shift_date, start_time, end_time")
      .eq("id", args.shiftId)
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!shift) throw new Error("Shift not found");

    const weekday = new Date(`${shift.shift_date}T00:00:00Z`).getUTCDay();
    const { data: availability, error: availabilityError } = await this.client
      .from("staff_availability_declarations")
      .select("available")
      .eq("staff_id", args.peerStaffId)
      .eq("weekday", weekday)
      .is("deleted_at", null)
      .limit(1);
    if (availabilityError) throw availabilityError;

    const { data: peerShifts, error: peerError } = await this.client
      .from("staff_shifts")
      .select("id, staff_id, start_time, end_time")
      .eq("retailer_id", args.retailerId)
      .eq("staff_id", args.peerStaffId)
      .eq("shift_date", shift.shift_date)
      .is("deleted_at", null);
    if (peerError) throw peerError;

    const check = checkSwapRequest({
      shift: {
        staffId: shift.staff_id,
        startTime: shift.start_time.slice(0, 5),
        endTime: shift.end_time.slice(0, 5),
        sourceRef: `staff_shifts:${shift.id}`,
      },
      requestingStaffId: args.requestingStaffId,
      peerStaffId: args.peerStaffId,
      peerDeclaredAvailable: availability?.[0]?.available === true,
      peerExistingShifts: (peerShifts ?? []).map((row) => ({
        staffId: row.staff_id,
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
        sourceRef: `staff_shifts:${row.id}`,
      })),
    });
    if (!check.ok) return check;

    const { data, error: insertError } = await this.client
      .from("staff_shift_swap_requests")
      .insert({
        retailer_id: args.retailerId,
        shift_id: args.shiftId,
        requesting_staff_id: args.requestingStaffId,
        peer_staff_id: args.peerStaffId,
        state: "requested",
        ...(args.reason ? { reason: args.reason } : {}),
      })
      .select("id")
      .single();
    if (insertError) throw insertError;
    return { ok: true, id: data.id };
  }

  async setSwapState(args: {
    readonly retailerId: RetailerId;
    readonly swapId: string;
    readonly nextState: Exclude<SwapState, "requested" | "approved">;
  }): Promise<void> {
    const decided =
      args.nextState === "declined" || args.nextState === "withdrawn";
    const { error } = await this.client
      .from("staff_shift_swap_requests")
      .update({
        state: args.nextState,
        ...(decided ? { decided_at: new Date().toISOString() } : {}),
      })
      .eq("id", args.swapId)
      .eq("retailer_id", args.retailerId);
    if (error) throw error;
  }

  /**
   * Manager approval, and the only place the roster actually changes. The
   * skill re-check runs here rather than at request time because the roster
   * can move between the two, and the state that matters is the one at the
   * moment coverage changes.
   */
  async approveSwap(args: {
    readonly retailerId: RetailerId;
    readonly swapId: string;
    readonly approverStaffId: string;
    readonly requiredSkills?: readonly string[];
    readonly peerSkills?: readonly string[];
    readonly otherCoveringSkills?: readonly string[];
  }): Promise<{ readonly ok: true } | SwapCheck> {
    const { data: swap, error } = await this.client
      .from("staff_shift_swap_requests")
      .select("*")
      .eq("id", args.swapId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!swap) throw new Error("Swap request not found");

    const check = checkSwapApproval({
      state: (swap as SwapRow).state as SwapState,
      approverStaffId: args.approverStaffId,
      requestingStaffId: swap.requesting_staff_id,
      peerStaffId: swap.peer_staff_id,
      requiredSkills: args.requiredSkills ?? [],
      peerSkills: args.peerSkills ?? [],
      otherCoveringSkills: args.otherCoveringSkills ?? [],
    });
    if (!check.ok) return check;

    const { error: updateError } = await this.client
      .from("staff_shift_swap_requests")
      .update({
        state: "approved",
        approved_by_staff_id: args.approverStaffId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", args.swapId)
      .eq("retailer_id", args.retailerId)
      // Only a peer-accepted request can be approved; closes the race the
      // re-read above narrows but cannot eliminate.
      .eq("state", "accepted_by_peer");
    if (updateError) throw updateError;

    // The roster itself moves only now, and only as an explicit consequence
    // of an approved swap.
    const { error: shiftError } = await this.client
      .from("staff_shifts")
      .update({ staff_id: swap.peer_staff_id })
      .eq("id", swap.shift_id)
      .eq("retailer_id", args.retailerId);
    if (shiftError) throw shiftError;

    return { ok: true };
  }

  async listOpenSwaps(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly SwapRow[]> {
    const { data, error } = await this.client
      .from("staff_shift_swap_requests")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .in("state", ["requested", "accepted_by_peer"])
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}

/** Re-exported so callers can brand an id without importing @paon/domain. */
export const asRetailerId = (value: string): RetailerId =>
  asId<"RetailerId">(value);
