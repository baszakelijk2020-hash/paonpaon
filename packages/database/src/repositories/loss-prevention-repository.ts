/**
 * Loss prevention and the RFID pilot (PHASE 13.2).
 *
 * Three rules this class exists to hold:
 *
 * 1. A flagged adjustment is NOT applied when it is raised. It waits for a
 *    second pair of eyes, and only the approval writes the ledger entry.
 *    Applying first and asking later is not a control, it is a report.
 * 2. Independence means a different person AND a manager. The database
 *    refuses self-approval outright; the manager half is checked here,
 *    because authority lives in the staff record.
 * 3. An RFID sweep NEVER posts a balance. Observations reconcile into
 *    discrepancies a human reads; only a counted adjustment moves stock.
 *    There is deliberately no method on this class that turns a sweep into
 *    a ledger entry.
 *
 * There is also no method here that takes a staff id and returns a number.
 * The non-goal ("no employee accusation score") is kept structural rather
 * than documented — you cannot build a leaderboard from an API that never
 * aggregates by person.
 */

import {
  assessAdjustmentRisk,
  checkAdjustmentApproval,
  reconcileSweep,
  resolveSweepDiscrepancy,
  type ApprovalCheck,
  type EpcObservation,
  type FalsePositiveResolution,
  type RetailerId,
  type RiskAssessment,
  type RiskRuleKind,
  type SweepReconciliation,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { StockLedgerRepository } from "./stock-ledger-repository";

type RiskFlagRow = Database["public"]["Tables"]["stock_risk_flags"]["Row"];

/** The value at which an adjustment needs a second signature, in cents. */
export const DEFAULT_HIGH_VALUE_THRESHOLD_MINOR_UNITS = 50_000;

export interface PendingAdjustment {
  readonly flag: RiskFlagRow;
  readonly variantId: string;
  readonly locationId: string;
  readonly adjustmentQuantity: number;
  readonly reason: string;
  readonly sessionId: string;
}

export class LossPreventionRepository {
  private readonly ledger: StockLedgerRepository;

  constructor(private readonly client: PaonSupabaseClient) {
    this.ledger = new StockLedgerRepository(client);
  }

  /**
   * How risky this adjustment is, judged only on properties of the
   * adjustment itself. Nothing about who is making it enters here.
   */
  async assess(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly unitPriceMinorUnits: number;
    readonly adjustmentQuantity: number;
    readonly withinCountSession: boolean;
    readonly highValueThresholdMinorUnits?: number;
  }): Promise<RiskAssessment> {
    // How often this variant has already been adjusted. A property of the
    // stock, not of a person: the same count is reached whether one member
    // of staff made all of them or five did.
    const { count, error } = await this.client
      .from("stock_ledger_entries")
      .select("id", { count: "exact", head: true })
      .eq("retailer_id", args.retailerId)
      .eq("variant_id", args.variantId)
      .eq("kind", "count_adjustment");
    if (error) throw error;

    return assessAdjustmentRisk({
      valueMinorUnits:
        Math.abs(args.adjustmentQuantity) * args.unitPriceMinorUnits,
      highValueThresholdMinorUnits:
        args.highValueThresholdMinorUnits ??
        DEFAULT_HIGH_VALUE_THRESHOLD_MINOR_UNITS,
      priorAdjustmentsSameVariant: count ?? 0,
      withinCountSession: args.withinCountSession,
    });
  }

  /**
   * Raises a flag WITHOUT touching stock. The adjustment does not exist in
   * the ledger yet — that is the whole point. `ledger_entry_id` stays null
   * until an approval writes the entry, so an unapproved write-off cannot be
   * mistaken for a completed one.
   */
  async requestApproval(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
    readonly requestedByStaffId: string;
    readonly triggeredRules: readonly RiskRuleKind[];
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("stock_risk_flags")
      .insert({
        retailer_id: args.retailerId,
        location_id: args.locationId,
        requested_by_staff_id: args.requestedByStaffId,
        triggered_rules: [...args.triggeredRules],
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  async openFlags(args: {
    readonly retailerId: RetailerId;
    readonly locationId?: string;
  }): Promise<readonly RiskFlagRow[]> {
    let query = this.client
      .from("stock_risk_flags")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("approved_at", null)
      .order("created_at", { ascending: true });
    if (args.locationId) query = query.eq("location_id", args.locationId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async findFlag(args: {
    readonly retailerId: RetailerId;
    readonly flagId: string;
  }): Promise<RiskFlagRow | null> {
    const { data, error } = await this.client
      .from("stock_risk_flags")
      .select("*")
      .eq("id", args.flagId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Approves a flagged adjustment and THEN writes it. The ledger entry is
   * created here and nowhere else, so a refused approval cannot leave a
   * half-applied write-off behind.
   */
  async approveAndApply(args: {
    readonly retailerId: RetailerId;
    readonly flagId: string;
    readonly approverStaffId: string;
    readonly approverIsManager: boolean;
    readonly sessionId: string;
    readonly variantId: string;
    readonly locationId: string;
    readonly adjustmentQuantity: number;
    readonly reason: string;
  }): Promise<
    | { readonly ok: true; readonly ledgerEntryId: string }
    | Exclude<ApprovalCheck, { readonly ok: true }>
    | { readonly ok: false; readonly reason: string }
  > {
    const flag = await this.findFlag(args);
    if (!flag) return { ok: false, reason: "flag_not_found" };
    if (flag.approved_at !== null) {
      return { ok: false, reason: "already_approved" };
    }

    const check = checkAdjustmentApproval({
      // The flag exists, so approval is required by definition. Re-deriving
      // the assessment here would let a later threshold change silently
      // un-require a signature that was already asked for.
      assessment: {
        triggered: flag.triggered_rules as RiskRuleKind[],
        requiresIndependentApproval: true,
        rationale: "Raised for independent approval.",
      },
      requestedByStaffId: flag.requested_by_staff_id,
      approverStaffId: args.approverStaffId,
      approverIsManager: args.approverIsManager,
    });
    if (!check.ok) return check;

    // Only now does stock move.
    const applied = await this.ledger.adjustFromCount({
      retailerId: args.retailerId,
      sessionId: args.sessionId,
      variantId: args.variantId,
      locationId: args.locationId,
      adjustmentQuantity: args.adjustmentQuantity,
      reason: args.reason,
      recordedByStaffId: args.approverStaffId,
    });
    if (!applied.ok) return { ok: false, reason: applied.reason };

    const { error } = await this.client
      .from("stock_risk_flags")
      .update({
        approved_by_staff_id: args.approverStaffId,
        approved_at: new Date().toISOString(),
        ledger_entry_id: applied.id,
      })
      .eq("id", args.flagId)
      .eq("retailer_id", args.retailerId)
      .is("approved_at", null);
    if (error) throw error;

    return { ok: true, ledgerEntryId: applied.id };
  }

  // ── RFID pilot ────────────────────────────────────────────────────────

  /**
   * Records raw reader output. Every read is kept, including duplicates and
   * low-confidence ones: a sweep that quietly drops its bad reads looks
   * cleaner than it was, and the whole point of a pilot is to find out how
   * good the reader actually is.
   */
  async recordObservations(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
    readonly sweepId: string;
    readonly observations: readonly EpcObservation[];
  }): Promise<{ readonly recorded: number }> {
    const rows = args.observations.map((observation) => ({
      retailer_id: args.retailerId,
      location_id: args.locationId,
      sweep_id: args.sweepId,
      epc: observation.epc,
      zone_key: observation.zoneKey,
      observed_at: observation.observedAt,
      read_confidence: observation.readConfidence,
    }));
    if (rows.length === 0) return { recorded: 0 };

    const { data, error } = await this.client
      .from("rfid_sweep_observations")
      .insert(rows)
      .select("id");
    if (error) throw error;
    return { recorded: data?.length ?? 0 };
  }

  /**
   * Reconciles a sweep into something a human reads.
   *
   * Note what this returns and what it does NOT do: there is no ledger write
   * anywhere in it, and `postsBalanceChange` is false. A reader that can post
   * a balance is a reader that can write off a jacket somebody is wearing in
   * a fitting room.
   */
  async reconcile(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
    readonly sweepId: string;
    readonly expectedEpcs: readonly string[];
    readonly zoneKey: string;
    readonly confidenceFloor?: number;
  }): Promise<SweepReconciliation> {
    const { data, error } = await this.client
      .from("rfid_sweep_observations")
      .select("epc, zone_key, observed_at, read_confidence")
      .eq("retailer_id", args.retailerId)
      .eq("sweep_id", args.sweepId);
    if (error) throw error;

    const observations: EpcObservation[] = (data ?? []).map((row) => ({
      epc: row.epc,
      zoneKey: row.zone_key,
      observedAt: row.observed_at,
      readConfidence: row.read_confidence,
    }));

    return reconcileSweep({
      observations,
      expectedEpcs: args.expectedEpcs,
      zoneKey: args.zoneKey,
      ...(args.confidenceFloor !== undefined
        ? { confidenceFloor: args.confidenceFloor }
        : {}),
    });
  }

  /**
   * Persists the discrepancies a reconciliation found, so they can be
   * resolved by a person later rather than vanishing when the page reloads.
   */
  async recordDiscrepancies(args: {
    readonly retailerId: RetailerId;
    readonly sweepId: string;
    readonly reconciliation: SweepReconciliation;
  }): Promise<{ readonly recorded: number }> {
    const rows = [
      ...args.reconciliation.unobservedEpcs.map((epc) => ({
        retailer_id: args.retailerId,
        sweep_id: args.sweepId,
        epc,
        // `unobserved`, never `missing`. A tag goes unread for a dozen
        // mundane reasons and "missing" invites a write-off.
        kind: "unobserved" as const,
      })),
      ...args.reconciliation.unexpectedEpcs.map((epc) => ({
        retailer_id: args.retailerId,
        sweep_id: args.sweepId,
        epc,
        kind: "unexpected" as const,
      })),
    ];
    if (rows.length === 0) return { recorded: 0 };

    const { data, error } = await this.client
      .from("rfid_sweep_discrepancies")
      .upsert(rows, { onConflict: "sweep_id,epc,kind" })
      .select("id");
    if (error) throw error;
    return { recorded: data?.length ?? 0 };
  }

  async openDiscrepancies(args: {
    readonly retailerId: RetailerId;
    readonly sweepId?: string;
  }): Promise<
    readonly Database["public"]["Tables"]["rfid_sweep_discrepancies"]["Row"][]
  > {
    let query = this.client
      .from("rfid_sweep_discrepancies")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("resolved_at", null)
      .order("created_at", { ascending: true });
    if (args.sweepId) query = query.eq("sweep_id", args.sweepId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Closes a discrepancy WITH a stated reason. "Resolved" carrying no note
   * is indistinguishable from "ignored" a month later, which is why the rule
   * refuses rather than defaulting the text.
   */
  async resolveDiscrepancy(args: {
    readonly retailerId: RetailerId;
    readonly discrepancyId: string;
    readonly resolutionNote: string;
  }): Promise<
    | { readonly ok: true }
    | Exclude<FalsePositiveResolution, { readonly ok: true }>
  > {
    const existing = await this.client
      .from("rfid_sweep_discrepancies")
      .select("id, resolved_at")
      .eq("id", args.discrepancyId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (existing.error) throw existing.error;

    const check = resolveSweepDiscrepancy({
      open: existing.data !== null && existing.data.resolved_at === null,
      resolutionNote: args.resolutionNote,
    });
    if (!check.ok) return check;

    const { error } = await this.client
      .from("rfid_sweep_discrepancies")
      .update({
        resolved_at: new Date().toISOString(),
        resolution_note: args.resolutionNote.trim(),
      })
      .eq("id", args.discrepancyId)
      .eq("retailer_id", args.retailerId)
      .is("resolved_at", null);
    if (error) throw error;
    return { ok: true };
  }
}
