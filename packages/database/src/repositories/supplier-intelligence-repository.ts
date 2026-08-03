/**
 * Supplier/atelier intelligence and support operations (MTM-101 / PHASE
 * 12.4). Thin persistence over the domain checks in
 * `@paon/domain`'s `production/supplier-intelligence.ts` — the checks stay
 * pure, this repository is the only place they meet the database.
 */

import {
  checkComplaintTransition,
  checkFabricButtonPairing,
  checkSupplyException,
  resolveSupplierFact,
  type ComplaintCheck,
  type ComplaintState,
  type ExceptionCheck,
  type PairingCheck,
  type RetailerId,
  type SupplierFact,
  type SupplierFactKind,
  type SupplierFactResolution,
  type SupplyExceptionKind,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type SupplierFactRow = Database["public"]["Tables"]["supplier_facts"]["Row"];
type FabricButtonRuleRow =
  Database["public"]["Tables"]["fabric_button_rules"]["Row"];
type SupplyExceptionRow =
  Database["public"]["Tables"]["supply_exceptions"]["Row"];
type SupplyComplaintCaseRow =
  Database["public"]["Tables"]["supply_complaint_cases"]["Row"];

function toDomainFact(row: SupplierFactRow): SupplierFact {
  return {
    kind: row.kind as SupplierFactKind,
    supplierKey: row.supplier_key,
    materialKey: row.material_key,
    value: row.value,
    sourceAuthorityKey: row.source_authority_key,
    observedAt: row.observed_at,
    sourceVersion: row.source_version,
  };
}

export class SupplierIntelligenceRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Append-only: a correction is a new observation, never an edit. */
  async recordFact(args: {
    readonly retailerId: RetailerId;
    readonly fact: SupplierFact;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("supplier_facts")
      .insert({
        retailer_id: args.retailerId,
        supplier_key: args.fact.supplierKey,
        material_key: args.fact.materialKey,
        kind: args.fact.kind,
        value: args.fact.value,
        source_authority_key: args.fact.sourceAuthorityKey,
        source_version: args.fact.sourceVersion,
        observed_at: args.fact.observedAt,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  async findFactsByRetailer(args: {
    readonly retailerId: RetailerId;
    readonly materialKey?: string;
  }): Promise<readonly SupplierFactRow[]> {
    let query = this.client
      .from("supplier_facts")
      .select("*")
      .eq("retailer_id", args.retailerId);
    if (args.materialKey) {
      query = query.eq("material_key", args.materialKey);
    }
    const { data, error } = await query.order("observed_at", {
      ascending: false,
    });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Resolves one fact against the registered authorities for this
   * retailer. Delegates entirely to `resolveSupplierFact` — this method
   * only fetches the candidate rows and maps them to the domain shape.
   */
  async resolveFact(args: {
    readonly retailerId: RetailerId;
    readonly kind: SupplierFactKind;
    readonly materialKey: string;
    readonly registeredAuthorityKeys: readonly string[];
    readonly asOf: string;
    readonly stalenessHours?: number;
  }): Promise<SupplierFactResolution> {
    const rows = await this.findFactsByRetailer({
      retailerId: args.retailerId,
      materialKey: args.materialKey,
    });
    return resolveSupplierFact({
      facts: rows.map(toDomainFact),
      kind: args.kind,
      materialKey: args.materialKey,
      registeredAuthorityKeys: args.registeredAuthorityKeys,
      asOf: args.asOf,
      ...(args.stalenessHours !== undefined
        ? { stalenessHours: args.stalenessHours }
        : {}),
    });
  }

  async findFabricButtonRules(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly FabricButtonRuleRow[]> {
    const { data, error } = await this.client
      .from("fabric_button_rules")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .order("fabric_key", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  /** Checks the pairing against the retailer's own rules before returning. */
  async checkPairing(args: {
    readonly retailerId: RetailerId;
    readonly fabricKey: string;
    readonly buttonKey: string;
  }): Promise<PairingCheck> {
    const rules = await this.findFabricButtonRules({
      retailerId: args.retailerId,
    });
    return checkFabricButtonPairing({
      rules: rules.map((row) => ({
        fabricKey: row.fabric_key,
        allowedButtonKeys: row.allowed_button_keys,
        note: row.note,
      })),
      fabricKey: args.fabricKey,
      buttonKey: args.buttonKey,
    });
  }

  async upsertFabricButtonRule(args: {
    readonly retailerId: RetailerId;
    readonly fabricKey: string;
    readonly allowedButtonKeys: readonly string[];
    readonly note: string;
  }): Promise<void> {
    const { error } = await this.client.from("fabric_button_rules").upsert(
      {
        retailer_id: args.retailerId,
        fabric_key: args.fabricKey,
        allowed_button_keys: [...args.allowedButtonKeys],
        note: args.note.trim(),
      },
      { onConflict: "retailer_id,fabric_key" },
    );
    if (error) throw error;
  }

  async findExceptions(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly SupplyExceptionRow[]> {
    const { data, error } = await this.client
      .from("supply_exceptions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createException(args: {
    readonly retailerId: RetailerId;
    readonly kind: SupplyExceptionKind;
    readonly materialKey: string;
    readonly ownerStaffId: string;
    readonly detail: string;
    readonly citations: readonly {
      readonly sourceAuthorityKey: string;
      readonly sourceVersion: string;
      readonly observedAt: string;
    }[];
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<ExceptionCheck, { readonly ok: true }>
  > {
    const check = checkSupplyException({
      kind: args.kind,
      materialKey: args.materialKey,
      ownerStaffId: args.ownerStaffId,
      detail: args.detail,
      citations: args.citations,
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("supply_exceptions")
      .insert({
        retailer_id: args.retailerId,
        kind: args.kind,
        material_key: args.materialKey,
        owner_staff_id: args.ownerStaffId,
        detail: args.detail.trim(),
        citations: args.citations as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }

  async resolveException(args: {
    readonly retailerId: RetailerId;
    readonly exceptionId: string;
    readonly resolutionNote: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("supply_exceptions")
      .update({
        state: "resolved",
        resolved_at: new Date().toISOString(),
        resolution_note: args.resolutionNote.trim(),
      })
      .eq("id", args.exceptionId)
      .eq("retailer_id", args.retailerId);
    if (error) throw error;
  }

  async acknowledgeException(args: {
    readonly retailerId: RetailerId;
    readonly exceptionId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("supply_exceptions")
      .update({ state: "acknowledged" })
      .eq("id", args.exceptionId)
      .eq("retailer_id", args.retailerId)
      .eq("state", "open");
    if (error) throw error;
  }

  async findComplaints(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly SupplyComplaintCaseRow[]> {
    const { data, error } = await this.client
      .from("supply_complaint_cases")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async createComplaint(args: {
    readonly retailerId: RetailerId;
    readonly summary: string;
    readonly customerId?: string;
    readonly orderId?: string;
    readonly pieceId?: string;
    readonly supplierKey?: string;
    readonly ownerStaffId?: string;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("supply_complaint_cases")
      .insert({
        retailer_id: args.retailerId,
        summary: args.summary.trim(),
        ...(args.customerId ? { customer_id: args.customerId } : {}),
        ...(args.orderId ? { order_id: args.orderId } : {}),
        ...(args.pieceId ? { piece_id: args.pieceId } : {}),
        ...(args.supplierKey ? { supplier_key: args.supplierKey } : {}),
        ...(args.ownerStaffId ? { owner_staff_id: args.ownerStaffId } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  /**
   * Transitions a complaint. Validated by `checkComplaintTransition` before
   * touching the row — the CHECK constraints in the migration are the same
   * rule as a second, independent enforcement layer, not the only one.
   */
  async transitionComplaint(args: {
    readonly retailerId: RetailerId;
    readonly complaintId: string;
    readonly to: ComplaintState;
    readonly evidenceRefs?: readonly string[];
    readonly customerRecoveryNote?: string;
    readonly supplierActionNote?: string;
    readonly outcomeNote?: string;
  }): Promise<
    { readonly ok: true } | Exclude<ComplaintCheck, { readonly ok: true }>
  > {
    const { data: current, error } = await this.client
      .from("supply_complaint_cases")
      .select("state, evidence_refs")
      .eq("id", args.complaintId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!current) throw new Error("Complaint not found");

    const evidenceRefs = args.evidenceRefs ?? current.evidence_refs ?? [];
    const check = checkComplaintTransition({
      from: current.state as ComplaintState,
      to: args.to,
      evidenceRefs,
      ...(args.outcomeNote ? { outcomeNote: args.outcomeNote } : {}),
    });
    if (!check.ok) return check;

    const { error: updateError } = await this.client
      .from("supply_complaint_cases")
      .update({
        state: args.to,
        evidence_refs: [...evidenceRefs],
        ...(args.customerRecoveryNote
          ? { customer_recovery_note: args.customerRecoveryNote.trim() }
          : {}),
        ...(args.supplierActionNote
          ? { supplier_action_note: args.supplierActionNote.trim() }
          : {}),
        ...(args.outcomeNote ? { outcome_note: args.outcomeNote.trim() } : {}),
      })
      .eq("id", args.complaintId)
      .eq("retailer_id", args.retailerId);
    if (updateError) throw updateError;
    return { ok: true };
  }
}
