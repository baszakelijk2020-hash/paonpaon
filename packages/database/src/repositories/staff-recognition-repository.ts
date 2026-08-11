/**
 * Extra-mile recognition repository (WFM-104 / PHASE 11.2).
 *
 * Writes are `authenticated` (unlike most repositories here) because an
 * employee logs their own act — see this migration's
 * `staff_recognition_acts_author_insert` policy, which pins the author to
 * the calling user so nobody can attribute a fabricated act to a colleague.
 * Review is manager-gated by RLS in addition to the domain-level
 * self-review check.
 */

import {
  asId,
  checkRecognitionReview,
  checkRecognitionSubmission,
  type RecognitionAct,
  type RecognitionReviewState,
  type RecognitionSubmissionCheck,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ActRow = Database["public"]["Tables"]["staff_recognition_acts"]["Row"];

function toAct(row: ActRow): RecognitionAct {
  return {
    id: row.id,
    retailerId: asId<"RetailerId">(row.retailer_id),
    staffId: row.staff_id,
    authoredByStaffId: row.authored_by_staff_id,
    narrative: row.narrative,
    ...(row.customer_id ? { customerId: row.customer_id } : {}),
    ...(row.appointment_id ? { appointmentId: row.appointment_id } : {}),
    ...(row.order_id ? { orderId: row.order_id } : {}),
    occurredOn: row.occurred_on,
    reviewState: row.review_state as RecognitionReviewState,
    ...(row.reviewed_by_staff_id
      ? { reviewedByStaffId: row.reviewed_by_staff_id }
      : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.coaching_note ? { coachingNote: row.coaching_note } : {}),
  };
}

export class StaffRecognitionRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listForRetailer(args: {
    readonly retailerId: RetailerId;
    readonly limit?: number;
  }): Promise<readonly RecognitionAct[]> {
    const { data, error } = await this.client
      .from("staff_recognition_acts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .limit(args.limit ?? 50);
    if (error) throw error;
    return (data ?? []).map(toAct);
  }

  async listForStaff(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly limit?: number;
  }): Promise<readonly RecognitionAct[]> {
    const { data, error } = await this.client
      .from("staff_recognition_acts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("staff_id", args.staffId)
      .is("deleted_at", null)
      .order("occurred_on", { ascending: false })
      .limit(args.limit ?? 30);
    if (error) throw error;
    return (data ?? []).map(toAct);
  }

  async listAwaitingReview(args: {
    readonly retailerId: RetailerId;
    readonly limit?: number;
  }): Promise<readonly RecognitionAct[]> {
    const { data, error } = await this.client
      .from("staff_recognition_acts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("review_state", "submitted")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(args.limit ?? 50);
    if (error) throw error;
    return (data ?? []).map(toAct);
  }

  /**
   * Validates via the domain layer before writing so an employee gets a
   * readable reason rather than a raw CHECK-constraint violation. The
   * constraint still exists as the real guarantee — this is a better error
   * message, not the enforcement.
   */
  async submitAct(args: {
    readonly retailerId: RetailerId;
    readonly staffId: string;
    readonly authoredByStaffId: string;
    readonly narrative: string;
    readonly occurredOn: string;
    readonly customerId?: string;
    readonly appointmentId?: string;
    readonly orderId?: string;
  }): Promise<
    | { readonly ok: true; readonly act: RecognitionAct }
    | RecognitionSubmissionCheck
  > {
    const check = checkRecognitionSubmission({ narrative: args.narrative });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("staff_recognition_acts")
      .insert({
        retailer_id: args.retailerId,
        staff_id: args.staffId,
        authored_by_staff_id: args.authoredByStaffId,
        narrative: args.narrative.trim(),
        occurred_on: args.occurredOn,
        review_state: "submitted",
        ...(args.customerId ? { customer_id: args.customerId } : {}),
        ...(args.appointmentId ? { appointment_id: args.appointmentId } : {}),
        ...(args.orderId ? { order_id: args.orderId } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, act: toAct(data) };
  }

  /**
   * Manager review. Re-reads the act first so the self-review and
   * already-reviewed checks run against current state rather than whatever
   * the UI last rendered — two managers opening the same queue must not
   * both be able to review the same act.
   */
  async reviewAct(args: {
    readonly retailerId: RetailerId;
    readonly actId: string;
    readonly reviewerStaffId: string;
    readonly nextState: Exclude<RecognitionReviewState, "submitted">;
    readonly coachingNote?: string;
  }): Promise<
    | { readonly ok: true; readonly act: RecognitionAct }
    | RecognitionSubmissionCheck
  > {
    const { data: current, error: readError } = await this.client
      .from("staff_recognition_acts")
      .select("*")
      .eq("id", args.actId)
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) throw new Error("Recognition act not found");

    const check = checkRecognitionReview({
      act: {
        staffId: current.staff_id,
        reviewState: current.review_state as RecognitionReviewState,
      },
      reviewerStaffId: args.reviewerStaffId,
      nextState: args.nextState,
      ...(args.coachingNote ? { coachingNote: args.coachingNote } : {}),
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("staff_recognition_acts")
      .update({
        review_state: args.nextState,
        reviewed_by_staff_id: args.reviewerStaffId,
        reviewed_at: new Date().toISOString(),
        ...(args.coachingNote
          ? { coaching_note: args.coachingNote.trim() }
          : {}),
      })
      .eq("id", args.actId)
      .eq("retailer_id", args.retailerId)
      // Only transition an act that is still awaiting review — closes the
      // race the re-read above narrows but cannot eliminate on its own.
      .eq("review_state", "submitted")
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, act: toAct(data) };
  }
}
