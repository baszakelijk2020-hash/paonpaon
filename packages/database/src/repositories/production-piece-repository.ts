/**
 * Serialized production pieces (INV-103 / PHASE 12.2). Thin persistence
 * over the pure checks in `@paon/domain`'s `production/serialized-piece.ts`
 * — stage transitions, spec-change gating, barcode identity and the
 * outworker whitelist all stay defined there; this repository only reads
 * and writes the rows the checks need.
 */

import {
  assessDelay,
  buildOutworkerTicket,
  buildPieceBarcode,
  checkOrderDispatch,
  checkSpecChange,
  checkStageTransition,
  type OutworkerTicket,
  type PieceKind,
  type PieceStage,
  type RetailerId,
  type StageTransitionCheck,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type SpecRow = Database["public"]["Tables"]["production_specs"]["Row"];
type PieceRow = Database["public"]["Tables"]["production_pieces"]["Row"];
type WorkTicketRow =
  Database["public"]["Tables"]["production_work_tickets"]["Row"];

export interface DelayedPiece {
  readonly piece: PieceRow;
  readonly daysLate: number;
  readonly requiresServiceRecovery: boolean;
}

export class ProductionPieceRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async createSpec(args: {
    readonly retailerId: RetailerId;
    readonly orderId: string;
    readonly customerId: string;
    readonly measurementVersionId: string;
    readonly spec?: Record<string, unknown>;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("production_specs")
      .insert({
        retailer_id: args.retailerId,
        order_id: args.orderId,
        customer_id: args.customerId,
        measurement_version_id: args.measurementVersionId,
        spec: (args.spec ?? {}) as unknown as Json,
        locked_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  async findSpecsByRetailer(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly SpecRow[]> {
    const { data, error } = await this.client
      .from("production_specs")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async findPiecesBySpec(specId: string): Promise<readonly PieceRow[]> {
    const { data, error } = await this.client
      .from("production_pieces")
      .select("*")
      .eq("spec_id", specId)
      .is("deleted_at", null)
      .order("piece_sequence", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async findPiecesByRetailer(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly PieceRow[]> {
    const { data, error } = await this.client
      .from("production_pieces")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Barcode is derived from the piece, never a second counter. */
  async addPiece(args: {
    readonly retailerId: RetailerId;
    readonly specId: string;
    readonly orderId: string;
    readonly orderNumber: string;
    readonly retailerCode: string;
    readonly pieceKind: PieceKind;
    readonly pieceSequence: number;
    readonly promisedOn?: string;
  }): Promise<{ readonly id: string; readonly barcode: string }> {
    // Stored uppercase, matching `parsePieceBarcode`'s own normalization —
    // a barcode is scanned, not typed carefully, so its canonical form has
    // to tolerate whatever case a scanner or a person keys in, and that
    // only works if storage and lookup agree on one case.
    const barcode = buildPieceBarcode({
      retailerCode: args.retailerCode,
      orderNumber: args.orderNumber,
      pieceKind: args.pieceKind,
      pieceSequence: args.pieceSequence,
    }).toUpperCase();
    const { data, error } = await this.client
      .from("production_pieces")
      .insert({
        retailer_id: args.retailerId,
        spec_id: args.specId,
        order_id: args.orderId,
        piece_kind: args.pieceKind,
        piece_sequence: args.pieceSequence,
        barcode,
        ...(args.promisedOn ? { promised_on: args.promisedOn } : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id, barcode };
  }

  async findPieceByBarcode(args: {
    readonly retailerId: RetailerId;
    readonly barcode: string;
  }): Promise<PieceRow | null> {
    const { data, error } = await this.client
      .from("production_pieces")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("barcode", args.barcode.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Transitions one piece's stage. Validated by `checkStageTransition`
   * before touching anything, then writes BOTH the append-only event (the
   * record) and the convenience `stage` column on the piece.
   */
  async transitionStage(args: {
    readonly retailerId: RetailerId;
    readonly pieceId: string;
    readonly to: PieceStage;
    readonly recordedByStaffId?: string;
    readonly defectNote?: string;
    readonly inspectorStaffId?: string;
  }): Promise<
    { readonly ok: true } | Exclude<StageTransitionCheck, { readonly ok: true }>
  > {
    const { data: piece, error } = await this.client
      .from("production_pieces")
      .select("stage, maker_staff_id, order_id")
      .eq("id", args.pieceId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!piece) throw new Error("Piece not found");

    const from = piece.stage as PieceStage;
    const check = checkStageTransition({
      from,
      to: args.to,
      ...(args.defectNote ? { defectNote: args.defectNote } : {}),
      ...(args.inspectorStaffId
        ? { inspectorStaffId: args.inspectorStaffId }
        : {}),
      ...(piece.maker_staff_id ? { makerStaffId: piece.maker_staff_id } : {}),
    });
    if (!check.ok) return check;

    // A dispatch is an order-level event even though stages are per piece:
    // refuse it while a sibling piece on the same order (a jacket's
    // trousers) is not yet ready, rather than letting one piece leave
    // before the suit is actually complete.
    if (args.to === "dispatched") {
      const { data: siblings, error: siblingsError } = await this.client
        .from("production_pieces")
        .select("stage")
        .eq("order_id", piece.order_id)
        .eq("retailer_id", args.retailerId)
        .is("deleted_at", null);
      if (siblingsError) throw siblingsError;
      const dispatchCheck = checkOrderDispatch({
        pieceStages: (siblings ?? []).map((row) => row.stage as PieceStage),
      });
      if (!dispatchCheck.ok) return dispatchCheck;
    }

    const { error: eventError } = await this.client
      .from("production_stage_events")
      .insert({
        retailer_id: args.retailerId,
        piece_id: args.pieceId,
        from_stage: from,
        to_stage: args.to,
        ...(args.defectNote ? { defect_note: args.defectNote } : {}),
        ...(args.inspectorStaffId
          ? { inspector_staff_id: args.inspectorStaffId }
          : {}),
        ...(args.recordedByStaffId
          ? { recorded_by_staff_id: args.recordedByStaffId }
          : {}),
      });
    if (eventError) throw eventError;

    const { error: updateError } = await this.client
      .from("production_pieces")
      .update({
        stage: args.to,
        ...(args.to === "dispatched"
          ? { completed_on: new Date().toISOString().slice(0, 10) }
          : {}),
        ...(args.recordedByStaffId
          ? { maker_staff_id: args.recordedByStaffId }
          : {}),
      })
      .eq("id", args.pieceId)
      .eq("retailer_id", args.retailerId);
    if (updateError) throw updateError;

    return { ok: true };
  }

  /**
   * Whether the spec behind this piece can still be edited plainly, or
   * needs an amendment — keyed off this specific piece's own stage, since
   * a spec covers a whole order but pieces (jacket, trousers) can be cut
   * at different times.
   */
  async checkSpecEditable(
    pieceId: string,
  ): Promise<
    | ReturnType<typeof checkSpecChange>
    | { readonly ok: true; readonly requiresAmendment: false }
  > {
    const { data: piece, error } = await this.client
      .from("production_pieces")
      .select("stage")
      .eq("id", pieceId)
      .maybeSingle();
    if (error) throw error;
    if (!piece) throw new Error("Piece not found");
    return checkSpecChange({ stage: piece.stage as PieceStage });
  }

  async amendSpec(args: {
    readonly retailerId: RetailerId;
    readonly specId: string;
    readonly pieceStage: PieceStage;
    readonly reason: string;
    readonly costDecision:
      "retailer_absorbs" | "customer_pays" | "supplier_credit";
    readonly amendedByStaffId: string;
    readonly changes?: Record<string, unknown>;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<ReturnType<typeof checkSpecChange>, { readonly ok: true }>
  > {
    const check = checkSpecChange({
      stage: args.pieceStage,
      reason: args.reason,
      costDecision: args.costDecision,
    });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("production_spec_amendments")
      .insert({
        retailer_id: args.retailerId,
        spec_id: args.specId,
        reason: args.reason.trim(),
        cost_decision: args.costDecision,
        amended_by_staff_id: args.amendedByStaffId,
        changes: (args.changes ?? {}) as unknown as Json,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { ok: true, id: data.id };
  }

  async findAmendmentsBySpec(
    specId: string,
  ): Promise<
    readonly Database["public"]["Tables"]["production_spec_amendments"]["Row"][]
  > {
    const { data, error } = await this.client
      .from("production_spec_amendments")
      .select("*")
      .eq("spec_id", specId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async issueWorkTicket(args: {
    readonly retailerId: RetailerId;
    readonly pieceId: string;
    readonly instructions: string;
    readonly dueOn: string;
    readonly outworkerReference?: string;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("production_work_tickets")
      .insert({
        retailer_id: args.retailerId,
        piece_id: args.pieceId,
        instructions: args.instructions.trim(),
        due_on: args.dueOn,
        ...(args.outworkerReference
          ? { assigned_outworker_reference: args.outworkerReference }
          : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  async findWorkTicketsByRetailer(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly WorkTicketRow[]> {
    const { data, error } = await this.client
      .from("production_work_tickets")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .order("issued_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /**
   * The whitelist projection an outworker actually sees — built from the
   * ticket, its piece and the order's customer, but returning ONLY
   * `OutworkerTicket`'s fields. Never returns the underlying rows.
   */
  async getOutworkerTicketView(
    ticketId: string,
  ): Promise<OutworkerTicket | null> {
    const { data: ticket, error: ticketError } = await this.client
      .from("production_work_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return null;

    const { data: piece, error: pieceError } = await this.client
      .from("production_pieces")
      .select("barcode, piece_kind, stage, spec_id")
      .eq("id", ticket.piece_id)
      .maybeSingle();
    if (pieceError) throw pieceError;
    if (!piece) return null;

    const { data: spec, error: specError } = await this.client
      .from("production_specs")
      .select("customer_id")
      .eq("id", piece.spec_id)
      .maybeSingle();
    if (specError) throw specError;
    if (!spec) return null;

    const { data: customer, error: customerError } = await this.client
      .from("customers")
      .select("full_name")
      .eq("id", spec.customer_id)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return null;

    return buildOutworkerTicket({
      barcode: piece.barcode,
      pieceKind: piece.piece_kind as PieceKind,
      stage: piece.stage as PieceStage,
      instructions: ticket.instructions,
      dueOn: ticket.due_on,
      customerFullName: customer.full_name,
    });
  }

  async listDelayedPieces(args: {
    readonly retailerId: RetailerId;
    readonly asOf: string;
  }): Promise<readonly DelayedPiece[]> {
    const { data, error } = await this.client
      .from("production_pieces")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .is("deleted_at", null)
      .not("stage", "in", "(ready,dispatched)")
      .not("promised_on", "is", null);
    if (error) throw error;
    return (data ?? [])
      .map((piece) => {
        const assessment = assessDelay({
          promisedOn: piece.promised_on!,
          asOf: args.asOf,
          ...(piece.completed_on ? { completedOn: piece.completed_on } : {}),
        });
        return {
          piece,
          daysLate: assessment.daysLate,
          requiresServiceRecovery: assessment.requiresServiceRecovery,
        };
      })
      .filter((entry) => entry.daysLate > 0);
  }
}
