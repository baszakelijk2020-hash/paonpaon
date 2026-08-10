/**
 * Shift closeout repository (WFM-104 / PHASE 11.2).
 *
 * Writes are `authenticated` because an employee closes out their own shift.
 * The RLS policy pins staff_id to the calling user, and managers can update
 * any closeout in their retailer.
 */

import {
  asId,
  checkCloseoutSubmission,
  type CloseoutSubmissionCheck,
  type RetailerId,
  type ShiftCloseout,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type CloseoutRow = Database["public"]["Tables"]["staff_shift_closeouts"]["Row"];

function toCloseout(row: CloseoutRow): ShiftCloseout {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    staffId: row.staff_id,
    closeoutDate: row.closeout_date,
    promisesNote: row.promises_note,
    ...(row.facts_learned_note
      ? { factsLearnedNote: row.facts_learned_note }
      : {}),
    ...(row.problems_note ? { problemsNote: row.problems_note } : {}),
    ...(row.anomalies_note ? { anomaliesNote: row.anomalies_note } : {}),
    whatWorkedNote: row.what_worked_note,
    ...(row.help_requested_note
      ? { helpRequestedNote: row.help_requested_note }
      : {}),
    ...(row.extra_mile_act_id ? { extraMileActId: row.extra_mile_act_id } : {}),
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ShiftCloseoutRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /**
   * Find a closeout for a specific staff member and date. Returns null if
   * not found (staff member can read their own; managers can read any).
   */
  async findByStaffAndDate(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly closeoutDate: string;
  }): Promise<ShiftCloseout | null> {
    const { data, error } = await this.client
      .from("staff_shift_closeouts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("staff_id", args.staffId)
      .eq("closeout_date", args.closeoutDate)
      .maybeSingle();
    if (error) throw error;
    return data ? toCloseout(data) : null;
  }

  /**
   * List a staff member's own closeouts for a date range. Returns most
   * recent first.
   */
  async listForStaff(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly limit?: number;
  }): Promise<readonly ShiftCloseout[]> {
    const { data, error } = await this.client
      .from("staff_shift_closeouts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("staff_id", args.staffId)
      .order("closeout_date", { ascending: false })
      .limit(args.limit ?? 30);
    if (error) throw error;
    return (data ?? []).map(toCloseout);
  }

  /**
   * List all closeouts for a retailer on a specific date. Managers use this
   * to see the team's closeouts. Returns results ordered by staff ID.
   */
  async listForRetailerAndDate(args: {
    readonly retailerId: RetailerId;
    readonly closeoutDate: string;
  }): Promise<readonly ShiftCloseout[]> {
    const { data, error } = await this.client
      .from("staff_shift_closeouts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("closeout_date", args.closeoutDate)
      .order("staff_id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toCloseout);
  }

  /**
   * Upsert a closeout. Validates via the domain layer before writing so an
   * employee gets a readable reason rather than a raw CHECK-constraint
   * violation. The constraint still exists as the real guarantee — this is
   * a better error message, not the enforcement.
   */
  async upsertCloseout(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly closeoutDate: string;
    readonly promisesNote: string;
    readonly whatWorkedNote: string;
    readonly factsLearnedNote?: string;
    readonly problemsNote?: string;
    readonly anomaliesNote?: string;
    readonly helpRequestedNote?: string;
    readonly extraMileActId?: string;
  }): Promise<
    | { readonly ok: true; readonly closeout: ShiftCloseout }
    | CloseoutSubmissionCheck
  > {
    const check = checkCloseoutSubmission({
      promisesNote: args.promisesNote,
      whatWorkedNote: args.whatWorkedNote,
      ...(args.factsLearnedNote
        ? { factsLearnedNote: args.factsLearnedNote }
        : {}),
      ...(args.problemsNote ? { problemsNote: args.problemsNote } : {}),
      ...(args.anomaliesNote ? { anomaliesNote: args.anomaliesNote } : {}),
      ...(args.helpRequestedNote
        ? { helpRequestedNote: args.helpRequestedNote }
        : {}),
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("staff_shift_closeouts")
      .upsert(
        {
          retailer_id: args.retailerId,
          staff_id: args.staffId,
          closeout_date: args.closeoutDate,
          promises_note: args.promisesNote.trim(),
          what_worked_note: args.whatWorkedNote.trim(),
          ...(args.factsLearnedNote
            ? { facts_learned_note: args.factsLearnedNote.trim() }
            : {}),
          ...(args.problemsNote
            ? { problems_note: args.problemsNote.trim() }
            : {}),
          ...(args.anomaliesNote
            ? { anomalies_note: args.anomaliesNote.trim() }
            : {}),
          ...(args.helpRequestedNote
            ? { help_requested_note: args.helpRequestedNote.trim() }
            : {}),
          ...(args.extraMileActId
            ? { extra_mile_act_id: args.extraMileActId }
            : {}),
        },
        {
          onConflict: "retailer_id,staff_id,closeout_date",
        },
      )
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, closeout: toCloseout(data) };
  }
}
