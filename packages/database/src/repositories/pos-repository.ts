/**
 * Point of sale (PHASE 13.3).
 *
 * This is where 13.1's ledger stops being merely correct and starts being
 * useful: completing a sale writes the `sale` entries, and a return writes
 * the restock. The POS never keeps its own idea of stock.
 *
 * Four rules the class exists to enforce:
 *
 * 1. A completed transaction is final. `pos_transactions` has no exit from
 *    `completed`, so the correction for a completed sale is a RETURN — a new
 *    transaction linked to the original. That is what makes stock and
 *    financial history survive a refund.
 * 2. Card data is refused, not dropped. `capturePayment` rejects the whole
 *    call if a card-shaped field name is present, because silently
 *    discarding it teaches the caller it was stored.
 * 3. Stock only moves on completion. A cart holds `reservation` entries; the
 *    `sale` entries are written when the money is taken, so an abandoned
 *    cart releases rather than sells.
 * 4. Mixed carts are never netted. RTW, alteration service and MTM stay
 *    separate lines because they behave differently on return.
 */

import {
  CASH_TENDER,
  checkPaymentCapture,
  checkSaleCompletable,
  checkReturnEligibility,
  checkTransactionTransition,
  totalCart,
  type CartLine,
  type CartLineKind,
  type CartTotals,
  type PaymentCaptureCheck,
  type RetailerId,
  type ReturnEligibility,
  type SaleCompletionCheck,
  type TransactionCheck,
  type TransactionState,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type TransactionRow = Database["public"]["Tables"]["pos_transactions"]["Row"];
type LineRow = Database["public"]["Tables"]["pos_transaction_lines"]["Row"];

/**
 * Providers ADR-062 has actually activated. Empty by design until a money
 * decision exists — `checkPaymentCapture` then refuses every capture, which
 * is the correct behaviour for a platform with no approved provider rather
 * than a bug to work around.
 */
export const ACTIVATED_PAYMENT_PROVIDERS: readonly string[] = [];

function toCartLine(row: LineRow): CartLine {
  return {
    lineId: row.id,
    kind: row.kind as CartLineKind,
    ...(row.variant_id ? { variantId: row.variant_id } : {}),
    quantity: row.quantity,
    unitPriceMinorUnits: row.unit_price_minor_units,
    reservesStock: row.kind === "rtw",
  };
}

export interface TransactionWithLines {
  readonly transaction: TransactionRow;
  readonly lines: readonly CartLine[];
  readonly totals: CartTotals;
}

export class PosRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async openTransaction(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
    readonly staffId?: string;
    readonly customerId?: string;
  }): Promise<TransactionRow> {
    const { data, error } = await this.client
      .from("pos_transactions")
      .insert({
        retailer_id: args.retailerId,
        location_id: args.locationId,
        state: "open",
        ...(args.staffId ? { staff_id: args.staffId } : {}),
        ...(args.customerId ? { customer_id: args.customerId } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * The sale currently on the counter. Deliberately excludes `suspended`:
   * suspending exists to clear the counter for a different customer while
   * holding the first one's cart aside, so a suspended sale must never
   * silently reappear here as if it were still being worked — the till
   * only shows it again once someone explicitly resumes it (see
   * `listSuspended` / `transition` to `open`).
   */
  async findOpenTransaction(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
  }): Promise<TransactionRow | null> {
    const { data, error } = await this.client
      .from("pos_transactions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("location_id", args.locationId)
      .in("state", ["open", "quoted", "awaiting_payment"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  /** Sales parked aside, oldest first — a queue, not a stack, so the first
   * customer suspended is the first one staff are reminded to return to. */
  async listSuspended(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
  }): Promise<readonly TransactionRow[]> {
    const { data, error } = await this.client
      .from("pos_transactions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("location_id", args.locationId)
      .eq("state", "suspended")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async load(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
  }): Promise<TransactionWithLines | null> {
    const { data: transaction, error } = await this.client
      .from("pos_transactions")
      .select("*")
      .eq("id", args.transactionId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!transaction) return null;

    const { data: lineRows, error: lineError } = await this.client
      .from("pos_transaction_lines")
      .select("*")
      .eq("transaction_id", args.transactionId)
      .order("created_at", { ascending: true });
    if (lineError) throw lineError;

    const lines = (lineRows ?? []).map(toCartLine);
    return { transaction, lines, totals: totalCart(lines) };
  }

  async listCompleted(args: {
    readonly retailerId: RetailerId;
    readonly locationId: string;
    readonly limit?: number;
  }): Promise<readonly TransactionRow[]> {
    const { data, error } = await this.client
      .from("pos_transactions")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("location_id", args.locationId)
      .eq("state", "completed")
      .order("completed_at", { ascending: false })
      .limit(args.limit ?? 10);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Adds a line. For RTW this also reserves the stock, so a cart genuinely
   * holds the garment and a second till cannot promise the same one. The
   * reservation id is kept on the line, which is what makes releasing it on
   * a void mechanical rather than remembered.
   */
  async addLine(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly locationId: string;
    readonly kind: CartLineKind;
    readonly quantity: number;
    readonly unitPriceMinorUnits: number;
    readonly variantId?: string;
    readonly currency?: string;
  }): Promise<
    | { readonly ok: true; readonly lineId: string }
    | { readonly ok: false; readonly reason: string }
  > {
    if (args.kind === "rtw" && !args.variantId) {
      return { ok: false, reason: "rtw_line_needs_variant" };
    }
    if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
      return { ok: false, reason: "quantity_not_positive" };
    }

    const { data, error } = await this.client.rpc("add_pos_line_atomic", {
      p_retailer_id: args.retailerId,
      p_transaction_id: args.transactionId,
      p_location_id: args.locationId,
      p_kind: args.kind,
      p_quantity: args.quantity,
      p_unit_price_minor_units: args.unitPriceMinorUnits,
      p_currency: args.currency ?? "EUR",
      ...(args.variantId ? { p_variant_id: args.variantId } : {}),
    });
    if (error) throw error;
    return data as unknown as
      | { readonly ok: true; readonly lineId: string }
      | { readonly ok: false; readonly reason: string };
  }

  /** Guards a state move through the pure transition table. */
  async transition(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly to: TransactionState;
    readonly voidReason?: string;
  }): Promise<{ readonly ok: true } | Exclude<TransactionCheck, { ok: true }>> {
    const loaded = await this.load(args);
    if (!loaded) throw new Error("Transaction not found");

    const check = checkTransactionTransition({
      from: loaded.transaction.state as TransactionState,
      to: args.to,
      lineCount: loaded.lines.length,
      ...(args.voidReason ? { voidReason: args.voidReason } : {}),
    });
    if (!check.ok) return check;

    const { error } = await this.client
      .from("pos_transactions")
      .update({
        state: args.to,
        ...(args.voidReason ? { void_reason: args.voidReason } : {}),
        ...(args.to === "completed"
          ? { completed_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", args.transactionId)
      .eq("retailer_id", args.retailerId)
      .eq("state", loaded.transaction.state);
    if (error) throw error;
    return { ok: true };
  }

  /**
   * Records that money was taken elsewhere. Refuses a provider ADR-062 has
   * not activated, and refuses outright if a card-shaped field is present.
   */
  async capturePayment(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly provider: string;
    /**
     * Optional for cash: there is no PSP to reference. One is derived per
     * transaction instead, which makes the unique constraint reject a
     * double-recorded cash tender rather than doubling the day's takings.
     */
    readonly providerReference?: string;
    readonly amountMinorUnits: number;
    readonly currency?: string;
    readonly rawFieldNames?: readonly string[];
    readonly activatedProviders?: readonly string[];
  }): Promise<
    { readonly ok: true } | Exclude<PaymentCaptureCheck, { ok: true }>
  > {
    const loaded = await this.load(args);
    if (!loaded) throw new Error("Transaction not found");

    const reference =
      args.providerReference ??
      (args.provider === CASH_TENDER ? `cash:${args.transactionId}` : "");

    const check = checkPaymentCapture({
      activatedProviders:
        args.activatedProviders ?? ACTIVATED_PAYMENT_PROVIDERS,
      provider: args.provider,
      providerReference: reference,
      capturedMinorUnits: args.amountMinorUnits,
      expectedMinorUnits: loaded.totals.subtotalMinorUnits,
      ...(args.rawFieldNames ? { rawFieldNames: args.rawFieldNames } : {}),
    });
    if (!check.ok) return check;

    const { data, error } = await this.client.rpc("record_pos_payment_atomic", {
      p_retailer_id: args.retailerId,
      p_transaction_id: args.transactionId,
      p_provider: args.provider,
      p_provider_reference: reference,
      p_amount_minor_units: args.amountMinorUnits,
      p_currency: args.currency ?? "EUR",
    });
    if (error) throw error;
    return data as unknown as
      { readonly ok: true } | Exclude<PaymentCaptureCheck, { ok: true }>;
  }

  /**
   * Completes the sale and moves the stock. The reservation is released and
   * a `sale` entry written for each RTW line, so on-hand falls exactly once
   * and the promise it was holding disappears with it.
   */
  /** Total money actually recorded against this transaction. */
  async capturedMinorUnits(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
  }): Promise<number> {
    const { data, error } = await this.client
      .from("pos_payments")
      .select("amount_minor_units")
      .eq("retailer_id", args.retailerId)
      .eq("transaction_id", args.transactionId);
    if (error) throw error;
    return (data ?? []).reduce((sum, row) => sum + row.amount_minor_units, 0);
  }

  /**
   * Completes the sale and moves the stock.
   *
   * Two things this deliberately does NOT do. It does not jump straight from
   * `open` to `completed` — the graph only reaches `completed` from
   * `awaiting_payment`, so the cart is presented for payment first and that
   * edge keeps its meaning. And it does not complete on request: the money
   * recorded against the transaction must cover the cart, or the stock would
   * move on a sale nobody paid for.
   *
   * Then the reservation is released and a `sale` entry written for each RTW
   * line, so on-hand falls exactly once and the promise it was holding
   * disappears with it.
   */
  async completeSale(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly locationId: string;
    readonly staffId?: string;
  }): Promise<
    | { readonly ok: true }
    | Exclude<SaleCompletionCheck, { readonly ok: true }>
    | Exclude<TransactionCheck, { readonly ok: true }>
  > {
    const loaded = await this.load(args);
    if (!loaded) throw new Error("Transaction not found");

    const ready = checkSaleCompletable({
      from: loaded.transaction.state as TransactionState,
      lineCount: loaded.lines.length,
      capturedMinorUnits: await this.capturedMinorUnits(args),
      expectedMinorUnits: loaded.totals.subtotalMinorUnits,
    });
    if (!ready.ok) return ready;

    const { data, error } = await this.client.rpc("complete_pos_sale_atomic", {
      p_retailer_id: args.retailerId,
      p_transaction_id: args.transactionId,
      p_location_id: args.locationId,
      ...(args.staffId ? { p_staff_id: args.staffId } : {}),
    });
    if (error) throw error;
    return data as unknown as
      | { readonly ok: true }
      | Exclude<SaleCompletionCheck, { readonly ok: true }>
      | Exclude<TransactionCheck, { readonly ok: true }>;
  }

  /**
   * Takes cash for the whole cart and closes the sale. This is the path a
   * shop can actually use today: no processor, no card, no ADR-062 gate.
   */
  async takeCashAndComplete(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly locationId: string;
    readonly staffId?: string;
  }): Promise<
    | { readonly ok: true }
    | Exclude<SaleCompletionCheck, { readonly ok: true }>
    | Exclude<TransactionCheck, { readonly ok: true }>
    | Exclude<PaymentCaptureCheck, { readonly ok: true }>
  > {
    const loaded = await this.load(args);
    if (!loaded) throw new Error("Transaction not found");
    if (loaded.lines.length === 0) {
      return { ok: false, reason: "nothing_to_sell" };
    }

    const { data, error } = await this.client.rpc(
      "take_cash_and_complete_pos_sale_atomic",
      {
        p_retailer_id: args.retailerId,
        p_transaction_id: args.transactionId,
        p_location_id: args.locationId,
        ...(args.staffId ? { p_staff_id: args.staffId } : {}),
      },
    );
    if (error) throw error;
    return data as unknown as
      | { readonly ok: true }
      | Exclude<SaleCompletionCheck, { readonly ok: true }>
      | Exclude<TransactionCheck, { readonly ok: true }>
      | Exclude<PaymentCaptureCheck, { readonly ok: true }>;
  }

  /**
   * Voids an unfinished sale, releasing every hold it was carrying. An
   * abandoned cart must not keep a garment off the shelf.
   */
  async voidTransaction(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly locationId: string;
    readonly voidReason: string;
  }): Promise<{ readonly ok: true } | Exclude<TransactionCheck, { ok: true }>> {
    const { data, error } = await this.client.rpc(
      "void_pos_transaction_atomic",
      {
        p_retailer_id: args.retailerId,
        p_transaction_id: args.transactionId,
        p_location_id: args.locationId,
        p_void_reason: args.voidReason,
      },
    );
    if (error) throw error;
    return data as unknown as
      { readonly ok: true } | Exclude<TransactionCheck, { ok: true }>;
  }

  /** Per-line eligibility, delegated to the pure rules. */
  async checkReturn(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly lineId: string;
    readonly requestedOn: string;
    readonly servicePerformed?: boolean;
  }): Promise<ReturnEligibility> {
    const loaded = await this.load(args);
    if (!loaded) throw new Error("Transaction not found");

    const { data: lineRow, error } = await this.client
      .from("pos_transaction_lines")
      .select("*")
      .eq("id", args.lineId)
      .eq("retailer_id", args.retailerId)
      .maybeSingle();
    if (error) throw error;
    if (!lineRow) throw new Error("Line not found");

    return checkReturnEligibility({
      line: toCartLine(lineRow),
      saleCompleted: loaded.transaction.state === "completed",
      soldOn: loaded.transaction.completed_at ?? loaded.transaction.created_at,
      requestedOn: args.requestedOn,
      alreadyReturnedQuantity: lineRow.returned_quantity,
      ...(args.servicePerformed !== undefined
        ? { servicePerformed: args.servicePerformed }
        : {}),
    });
  }

  /**
   * Returns one line. Creates a NEW transaction linked to the original,
   * restocks the goods, and records the returned quantity on the original
   * line so a second return of the same unit is refused. The original sale
   * is never edited.
   */
  async returnLine(args: {
    readonly retailerId: RetailerId;
    readonly transactionId: string;
    readonly locationId: string;
    readonly lineId: string;
    readonly requestedOn: string;
    readonly staffId?: string;
    readonly servicePerformed?: boolean;
  }): Promise<
    | {
        readonly ok: true;
        readonly returnTransactionId: string;
        readonly refundMinorUnits: number;
        readonly restocked: number;
      }
    | Exclude<ReturnEligibility, { ok: true }>
  > {
    const eligibility = await this.checkReturn(args);
    if (!eligibility.ok) return eligibility;

    const { data, error } = await this.client.rpc("return_pos_line_atomic", {
      p_retailer_id: args.retailerId,
      p_transaction_id: args.transactionId,
      p_location_id: args.locationId,
      p_line_id: args.lineId,
      p_requested_on: args.requestedOn,
      ...(args.staffId ? { p_staff_id: args.staffId } : {}),
      ...(args.servicePerformed !== undefined
        ? { p_service_performed: args.servicePerformed }
        : {}),
    });
    if (error) throw error;
    return data as unknown as
      | {
          readonly ok: true;
          readonly returnTransactionId: string;
          readonly refundMinorUnits: number;
          readonly restocked: number;
        }
      | Exclude<ReturnEligibility, { ok: true }>;
  }
}
