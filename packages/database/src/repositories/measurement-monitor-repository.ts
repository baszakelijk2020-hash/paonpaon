/**
 * MeasurementMonitor decision gate (FIT-101..103 / PHASE 12.1).
 *
 * There is no `approveCandidate(candidateId)` on this class, and adding one
 * would be a mistake. Approving is `recordApprovedVersion`, which takes
 * explicit values and a named advisor — the values an advisor actually
 * signed off, which may differ from what the scan proposed. Making the
 * advisor restate them is the difference between review and a rubber stamp.
 */

import {
  assessScanQuality,
  checkMeasurementApproval,
  checkReorderGate,
  decideMeasurementOutcome,
  type MeasurementApprovalCheck,
  type MeasurementDecisionResult,
  type MeasurementValue,
  type ReorderGateResult,
  type RetailerId,
  type ScanQualitySignals,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type VersionRow =
  Database["public"]["Tables"]["customer_measurement_versions"]["Row"];
type CandidateRow =
  Database["public"]["Tables"]["customer_measurement_candidates"]["Row"];

export class MeasurementMonitorRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async latestApprovedVersion(args: {
    readonly customerId: string;
  }): Promise<VersionRow | null> {
    const { data, error } = await this.client
      .from("customer_measurement_versions")
      .select("*")
      .eq("customer_id", args.customerId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Runs a scan through the quality gate and the decision rules, then
   * stores the candidate with its decision. Writes no measurement of
   * record under any outcome.
   */
  async recordCandidate(args: {
    readonly retailerId: RetailerId;
    readonly customerId: string;
    readonly values: readonly MeasurementValue[];
    readonly qualitySignals: ScanQualitySignals;
    readonly selfScanId?: string;
    readonly toleranceMillimetres?: Readonly<Record<string, number>>;
  }): Promise<{
    readonly id: string;
    readonly result: MeasurementDecisionResult;
  }> {
    const quality = assessScanQuality(args.qualitySignals);
    const approved = await this.latestApprovedVersion(args);
    const approvedValues = (approved?.values ??
      []) as unknown as MeasurementValue[];

    const result = decideMeasurementOutcome({
      approved: approvedValues,
      candidate: args.values,
      quality,
      ...(args.toleranceMillimetres
        ? { toleranceMillimetres: args.toleranceMillimetres }
        : {}),
    });

    const { data, error } = await this.client
      .from("customer_measurement_candidates")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        values: args.values as unknown as Json,
        quality_signals: args.qualitySignals as unknown as Json,
        quality_passed: quality.ok,
        decision: result.decision,
        decision_version: result.decisionVersion,
        deltas: result.deltas as unknown as Json,
        rationale: result.rationale,
        ...(args.selfScanId ? { self_scan_id: args.selfScanId } : {}),
        ...(approved ? { compared_to_version_id: approved.id } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, result };
  }

  /**
   * Creates the next approved version. The table has no UPDATE grant, so
   * this is the only way an approved measurement can change — and it is
   * append-only by construction rather than by convention.
   */
  async recordApprovedVersion(args: {
    readonly retailerId: RetailerId;
    readonly customerId: string;
    readonly values: readonly MeasurementValue[];
    readonly approvedByStaffId: string;
    readonly reviewNote?: string;
    readonly reviewedCandidateId?: string;
  }): Promise<
    | { readonly ok: true; readonly id: string; readonly version: number }
    | Exclude<MeasurementApprovalCheck, { ok: true }>
  > {
    const latest = await this.latestApprovedVersion(args);
    const nextVersion = (latest?.version ?? 0) + 1;

    const check = checkMeasurementApproval({
      values: args.values,
      nextVersion,
      ...(latest ? { latestApprovedVersion: latest.version } : {}),
      approvedByStaffId: args.approvedByStaffId,
      ...(args.reviewNote ? { reviewNote: args.reviewNote } : {}),
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("customer_measurement_versions")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        version: nextVersion,
        values: args.values as unknown as Json,
        approved_by_staff_id: args.approvedByStaffId,
        ...(args.reviewNote ? { review_note: args.reviewNote.trim() } : {}),
        ...(args.reviewedCandidateId
          ? { reviewed_candidate_id: args.reviewedCandidateId }
          : {}),
      })
      .select("id, version")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id, version: data.version };
  }

  /** Marks a candidate as dealt with, whichever way the advisor went. */
  async resolveCandidate(args: {
    readonly retailerId: RetailerId;
    readonly candidateId: string;
    readonly resolvedByStaffId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("customer_measurement_candidates")
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by_staff_id: args.resolvedByStaffId,
      })
      .eq("id", args.candidateId)
      .eq("retailer_id", args.retailerId)
      .is("resolved_at", null);
    if (error) throw error;
  }

  async openAdvisorReviews(args: {
    readonly customerId: string;
  }): Promise<readonly CandidateRow[]> {
    const { data, error } = await this.client
      .from("customer_measurement_candidates")
      .select("*")
      .eq("customer_id", args.customerId)
      .eq("decision", "advisor_review")
      .is("resolved_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * The reorder gate. Refuses while a review is open or the order's pinned
   * version has been superseded — a repeat order is exactly when a stale
   * measurement does real damage.
   */
  async checkReorderAllowed(args: {
    readonly customerId: string;
    readonly pinnedVersion?: number;
  }): Promise<ReorderGateResult> {
    const latest = await this.latestApprovedVersion(args);
    const open = await this.openAdvisorReviews(args);
    return checkReorderGate({
      ...(latest ? { latestApprovedVersion: latest.version } : {}),
      ...(args.pinnedVersion !== undefined
        ? { pinnedVersion: args.pinnedVersion }
        : {}),
      openAdvisorReviewCount: open.length,
    });
  }
}
