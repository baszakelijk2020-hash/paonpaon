/**
 * Stock ledger (INV-101 / INV-102 / PHASE 13.1).
 *
 * There is no balance to write. `stock_ledger_entries` is append-only — it
 * has no UPDATE or DELETE grant on any role — and a balance is always a
 * projection over it via the pure `projectBalance` in @paon/domain.
 *
 * Consequences that shape this class:
 *
 * - `receive`, `reserve`, `release`, `sell` and `transfer` only ever INSERT.
 * - `reverse` inserts a `reversal` row citing the original. Nothing is
 *   edited, so a mistake and its correction both stay on the record.
 * - `adjust` refuses unless an open count session and a stated reason exist,
 *   and refuses an amount larger than the count actually found. Shrinkage
 *   stays analysable instead of becoming unexplained corrections.
 * - A transfer writes TWO entries. Modelling it as one "move" would make
 *   in-transit stock invisible, and both facts — left one shop, not yet
 *   arrived at the other — are true at once.
 */

import {
  checkCountAdjustment,
  projectBalance,
  reconcileBlindCount,
  type AdjustmentCheck,
  type CountReconciliation,
  type LedgerEntry,
  type LedgerEntryKind,
  type ReservationCheck,
  type RetailerId,
  type StockBalance,
  type TransferCheck,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type EntryRow = Database["public"]["Tables"]["stock_ledger_entries"]["Row"];
type LocationRow = Database["public"]["Tables"]["stock_locations"]["Row"];
type SessionRow = Database["public"]["Tables"]["stock_count_sessions"]["Row"];

function toDomain(row: EntryRow): LedgerEntry {
  return {
    entryId: row.id,
    variantId: row.variant_id,
    locationId: row.location_id,
    kind: row.kind as LedgerEntryKind,
    quantity: row.quantity,
    occurredAt: row.occurred_at,
    ...(row.reverses_entry_id
      ? { reversesEntryId: row.reverses_entry_id }
      : {}),
    ...(row.idempotency_key ? { idempotencyKey: row.idempotency_key } : {}),
  };
}

export interface VariantBalance extends StockBalance {
  readonly variantId: string;
  readonly locationId: string;
}

export class StockLedgerRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listLocations(args: {
    readonly retailerId: RetailerId;
  }): Promise<readonly LocationRow[]> {
    const { data, error } = await this.client
      .from("stock_locations")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("active", true)
      .order("code", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async ensureLocation(args: {
    readonly retailerId: RetailerId;
    readonly code: string;
    readonly name: string;
  }): Promise<LocationRow> {
    const { data, error } = await this.client
      .from("stock_locations")
      .upsert(
        {
          retailer_id: args.retailerId,
          code: args.code,
          name: args.name,
          active: true,
        },
        { onConflict: "retailer_id,code" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  /** Every entry for one variant at one location, oldest first. */
  async entriesFor(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
  }): Promise<readonly LedgerEntry[]> {
    const { data, error } = await this.client
      .from("stock_ledger_entries")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("variant_id", args.variantId)
      .eq("location_id", args.locationId)
      .order("occurred_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }

  /** The only definition of a balance: a projection, never a stored column. */
  async balanceFor(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
  }): Promise<VariantBalance> {
    const entries = await this.entriesFor(args);
    return {
      variantId: args.variantId,
      locationId: args.locationId,
      ...projectBalance(entries),
    };
  }

  /**
   * Balances for every variant that has ever moved at a location. Projected
   * per variant from the same pure function, so the list on a screen and a
   * single lookup can never disagree.
   */
  async balancesAtLocation(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
  }): Promise<readonly VariantBalance[]> {
    const { data, error } = await this.client
      .from("stock_ledger_entries")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("location_id", args.locationId)
      .order("occurred_at", { ascending: true });
    if (error) throw error;

    const byVariant = new Map<string, LedgerEntry[]>();
    for (const row of data ?? []) {
      const list = byVariant.get(row.variant_id) ?? [];
      list.push(toDomain(row));
      byVariant.set(row.variant_id, list);
    }
    return [...byVariant.entries()]
      .map(([variantId, entries]) => ({
        variantId,
        locationId: args.locationId,
        ...projectBalance(entries),
      }))
      .sort((a, b) => a.variantId.localeCompare(b.variantId));
  }

  private async insertEntry(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
    readonly kind: LedgerEntryKind;
    readonly quantity: number;
    readonly recordedByStaffId?: string;
    readonly idempotencyKey?: string;
    readonly reason?: string;
    readonly countSessionId?: string;
    readonly reversesEntryId?: string;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client
      .from("stock_ledger_entries")
      .insert({
        retailer_id: args.retailerId,
        variant_id: args.variantId,
        location_id: args.locationId,
        kind: args.kind,
        quantity: args.quantity,
        ...(args.recordedByStaffId
          ? { recorded_by_staff_id: args.recordedByStaffId }
          : {}),
        ...(args.idempotencyKey
          ? { idempotency_key: args.idempotencyKey }
          : {}),
        ...(args.reason ? { reason: args.reason } : {}),
        ...(args.countSessionId
          ? { count_session_id: args.countSessionId }
          : {}),
        ...(args.reversesEntryId
          ? { reverses_entry_id: args.reversesEntryId }
          : {}),
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  }

  /** Goods in. */
  async receive(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
    readonly quantity: number;
    readonly recordedByStaffId?: string;
    readonly idempotencyKey?: string;
  }): Promise<{ readonly id: string }> {
    return this.insertEntry({ ...args, kind: "receipt" });
  }

  /**
   * Holds stock for a customer. Checks AVAILABLE, not on-hand: two people
   * reserving the last jacket is the failure mode, and on-hand says yes to
   * both.
   */
  async reserve(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
    readonly quantity: number;
    readonly recordedByStaffId?: string;
    readonly idempotencyKey?: string;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<ReservationCheck, { readonly ok: true }>
  > {
    const { data, error } = await this.client.rpc("reserve_stock_atomic", {
      p_retailer_id: args.retailerId,
      p_variant_id: args.variantId,
      p_location_id: args.locationId,
      p_quantity: args.quantity,
      ...(args.recordedByStaffId
        ? { p_recorded_by_staff_id: args.recordedByStaffId }
        : {}),
      ...(args.idempotencyKey
        ? { p_idempotency_key: args.idempotencyKey }
        : {}),
    });
    if (error) throw error;
    const result = data as unknown as
      | { readonly ok: true; readonly id: string }
      | Exclude<ReservationCheck, { readonly ok: true }>;
    return result;
  }

  async release(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
    readonly quantity: number;
    readonly recordedByStaffId?: string;
  }): Promise<{ readonly id: string }> {
    return this.insertEntry({ ...args, kind: "reservation_release" });
  }

  async sell(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly locationId: string;
    readonly quantity: number;
    readonly recordedByStaffId?: string;
    readonly idempotencyKey?: string;
  }): Promise<{ readonly id: string }> {
    return this.insertEntry({ ...args, kind: "sale" });
  }

  /**
   * Undoes an entry by adding a reversal that cites it. The sign is derived
   * from the cited entry by `projectBalance`, so a caller cannot mis-sign a
   * reversal, and the original stays visible.
   */
  async reverse(args: {
    readonly retailerId: RetailerId;
    readonly entryId: string;
    readonly recordedByStaffId?: string;
  }): Promise<{ readonly id: string }> {
    const { data, error } = await this.client.rpc(
      "reverse_stock_entry_atomic",
      {
        p_retailer_id: args.retailerId,
        p_entry_id: args.entryId,
        ...(args.recordedByStaffId
          ? { p_recorded_by_staff_id: args.recordedByStaffId }
          : {}),
      },
    );
    if (error) throw error;
    return data as unknown as { readonly id: string };
  }

  /**
   * Two entries, not one. In-transit stock stays visible because it has
   * left the origin and not yet arrived at the destination, and both of
   * those are true simultaneously.
   */
  async transfer(args: {
    readonly retailerId: RetailerId;
    readonly variantId: string;
    readonly fromLocationId: string;
    readonly toLocationId: string;
    readonly quantity: number;
    readonly recordedByStaffId?: string;
    readonly operationId?: string;
  }): Promise<
    | { readonly ok: true; readonly outId: string; readonly inId: string }
    | Exclude<TransferCheck, { readonly ok: true }>
  > {
    const { data, error } = await this.client.rpc("transfer_stock_atomic", {
      p_retailer_id: args.retailerId,
      p_variant_id: args.variantId,
      p_from_location_id: args.fromLocationId,
      p_to_location_id: args.toLocationId,
      p_quantity: args.quantity,
      ...(args.recordedByStaffId
        ? { p_recorded_by_staff_id: args.recordedByStaffId }
        : {}),
      ...(args.operationId ? { p_operation_id: args.operationId } : {}),
    });
    if (error) throw error;
    return data as unknown as
      | {
          readonly ok: true;
          readonly outId: string;
          readonly inId: string;
        }
      | Exclude<TransferCheck, { readonly ok: true }>;
  }

  // ------------------------------------------------------------- counts

  async openCountSession(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
    readonly openedByStaffId: string;
    readonly blind?: boolean;
  }): Promise<SessionRow> {
    const { data, error } = await this.client
      .from("stock_count_sessions")
      .insert({
        retailer_id: args.retailerId,
        location_id: args.locationId,
        opened_by_staff_id: args.openedByStaffId,
        blind: args.blind ?? true,
        state: "open",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async findOpenCountSession(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
  }): Promise<SessionRow | null> {
    const { data, error } = await this.client
      .from("stock_count_sessions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("location_id", args.locationId)
      .in("state", ["open", "counted", "recount_required"])
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /**
   * Records what was physically counted. One line per variant per session —
   * a second scan of the same variant corrects the line rather than adding
   * to it, which is what stops a recount doubling the figure.
   */
  async recordCountLine(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
    readonly variantId: string;
    readonly countedQuantity: number;
    readonly countedByStaffId?: string;
  }): Promise<void> {
    const { error } = await this.client.from("stock_count_lines").upsert(
      {
        retailer_id: args.retailerId,
        session_id: args.sessionId,
        variant_id: args.variantId,
        counted_quantity: args.countedQuantity,
        ...(args.countedByStaffId
          ? { counted_by_staff_id: args.countedByStaffId }
          : {}),
      },
      { onConflict: "session_id,variant_id" },
    );
    if (error) throw error;
  }

  /**
   * Compares the count against the ledger projection. Writes nothing:
   * posting a count straight onto a balance is the silent edit this item
   * exists to prevent.
   */
  async reconcileCount(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
    readonly locationId: string;
  }): Promise<CountReconciliation> {
    const { data: lines, error } = await this.client
      .from("stock_count_lines")
      .select("variant_id, counted_quantity")
      .eq("session_id", args.sessionId);
    if (error) throw error;

    const balances = await this.balancesAtLocation({
      retailerId: args.retailerId,
      locationId: args.locationId,
    });
    const expected = new Map(
      balances.map((balance) => [balance.variantId, balance.onHand]),
    );
    // Variants counted but never moved should still be compared, against an
    // expectation of zero, or a surplus of something new goes unnoticed.
    for (const line of lines ?? []) {
      if (!expected.has(line.variant_id)) expected.set(line.variant_id, 0);
    }

    return reconcileBlindCount({
      expected,
      counted: (lines ?? []).map((line) => ({
        variantId: line.variant_id,
        countedQuantity: line.counted_quantity,
      })),
    });
  }

  /**
   * Posts a reasoned adjustment. Refused unless a count session is open, no
   * recount is outstanding, the reason is real, and the amount does not
   * exceed what the count found.
   */
  async adjustFromCount(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
    readonly locationId: string;
    readonly variantId: string;
    readonly adjustmentQuantity: number;
    readonly reason: string;
    readonly recordedByStaffId?: string;
  }): Promise<
    | { readonly ok: true; readonly id: string }
    | Exclude<AdjustmentCheck, { readonly ok: true }>
  > {
    const reconciliation = await this.reconcileCount(args);
    const variance = reconciliation.variances.find(
      (entry) => entry.variantId === args.variantId,
    );

    const check = checkCountAdjustment({
      countSessionId: args.sessionId,
      ...(variance ? { variance } : {}),
      adjustmentQuantity: args.adjustmentQuantity,
      reason: args.reason,
      recountOutstanding: reconciliation.recountRequired,
    });
    if (!check.ok) return check;

    // The ledger stores a positive quantity and a signed KIND, so a
    // shortfall is a reversal-shaped negative expressed as a sale-free
    // count_adjustment of the absolute amount with its sign carried by the
    // projection. Keep the sign explicit in the reason for the reader.
    const { id } = await this.insertEntry({
      retailerId: args.retailerId,
      variantId: args.variantId,
      locationId: args.locationId,
      kind: "count_adjustment",
      quantity: args.adjustmentQuantity,
      reason: args.reason,
      countSessionId: args.sessionId,
      ...(args.recordedByStaffId
        ? { recordedByStaffId: args.recordedByStaffId }
        : {}),
    });
    return { ok: true, id };
  }

  async closeCountSession(args: {
    readonly retailerId: RetailerId;
    readonly sessionId: string;
    readonly state: "counted" | "recount_required" | "reconciled" | "abandoned";
  }): Promise<void> {
    const closed = args.state === "reconciled" || args.state === "abandoned";
    const { error } = await this.client
      .from("stock_count_sessions")
      .update({
        state: args.state,
        ...(closed ? { closed_at: new Date().toISOString() } : {}),
      })
      .eq("id", args.sessionId)
      .eq("retailer_id", args.retailerId);
    if (error) throw error;
  }
}
