/**
 * Live integration proof for point of sale (PHASE 13.3).
 *
 * The point of these assertions is the SEAM: a POS that keeps its own idea
 * of stock is a POS that oversells. Everything below checks that the till
 * and the ledger stay one truth — a cart holds, a completed sale moves, a
 * void releases, and a return restocks.
 *
 * Run with:
 *   PAON_INTEGRATION=1 pnpm --filter @paon/database exec vitest run \
 *     src/repositories/__integration__
 */

import type { RetailerId } from "@paon/domain";
import { beforeAll, describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../../client-type";
import { createSupabaseAdminClient } from "../../clients/admin";
import { PosRepository } from "../pos-repository";
import { StockLedgerRepository } from "../stock-ledger-repository";

const LIVE = process.env["PAON_INTEGRATION"] === "1";
const CHECK_VIOLATION = "23514";
const UNIQUE_VIOLATION = "23505";
const RUN = Date.now();

let admin: PaonSupabaseClient;
let pos: PosRepository;
let ledger: StockLedgerRepository;
let retailerId: RetailerId;
let staffId: string;
let variantId: string;

/** A fresh location per case, so no leftover balance can carry a test. */
async function freshLocation(tag: string): Promise<string> {
  return (
    await ledger.ensureLocation({
      retailerId,
      code: `POS-${tag}-${RUN}`,
      name: `POS ${tag} ${RUN}`,
    })
  ).id;
}

describe.skipIf(!LIVE)("point of sale, live (13.3)", () => {
  beforeAll(async () => {
    const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) throw new Error("Live integration needs Supabase env.");
    admin = createSupabaseAdminClient(url, key);
    pos = new PosRepository(admin);
    ledger = new StockLedgerRepository(admin);

    const { data: retailer } = await admin
      .from("retailers")
      .select("id")
      .limit(1)
      .single();
    retailerId = retailer!.id as RetailerId;

    const { data: staff } = await admin
      .from("retailer_staff_members")
      .select("id")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .limit(1)
      .single();
    staffId = staff!.id;

    const { data: variant } = await admin
      .from("product_variants")
      .select("id")
      .limit(1)
      .single();
    variantId = variant!.id;
  });

  it("a cart HOLDS stock: on-hand unchanged, availability gone", async () => {
    const locationId = await freshLocation("HOLD");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 2 });

    const transaction = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    const added = await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 2,
      unitPriceMinorUnits: 12000,
    });
    expect(added.ok).toBe(true);

    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(2);
    expect(balance.available).toBe(0);
  });

  it("REFUSES a second till promising the same last garment", async () => {
    const locationId = await freshLocation("CONTEND");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });

    const first = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    expect(
      (
        await pos.addLine({
          retailerId,
          transactionId: first.id,
          locationId,
          kind: "rtw",
          variantId,
          quantity: 1,
          unitPriceMinorUnits: 9900,
        })
      ).ok,
    ).toBe(true);

    // A different transaction reaching for the same unit.
    const second = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    const contended = await pos.addLine({
      retailerId,
      transactionId: second.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 9900,
    });
    expect(contended.ok).toBe(false);
    if (!contended.ok) expect(contended.reason).toBe("insufficient_available");
  });

  it("completing a sale moves stock exactly once", async () => {
    const locationId = await freshLocation("SELL");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 5 });

    const transaction = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 2,
      unitPriceMinorUnits: 12000,
    });

    const completed = await pos.takeCashAndComplete({
      retailerId,
      transactionId: transaction.id,
      locationId,
      staffId,
    });
    expect(completed.ok).toBe(true);

    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    // 5 - 2 sold. The hold is gone too, so availability is not double-counted.
    expect(balance.onHand).toBe(3);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(3);
  });

  it("a completed sale is FINAL — no state can move it", async () => {
    const locationId = await freshLocation("FINAL");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 5000,
    });
    await pos.takeCashAndComplete({
      retailerId,
      transactionId: transaction.id,
      locationId,
    });

    for (const to of ["open", "voided", "awaiting_payment"] as const) {
      const attempt = await pos.transition({
        retailerId,
        transactionId: transaction.id,
        to,
        voidReason: "Trying to reopen a completed sale.",
      });
      expect(attempt.ok).toBe(false);
      if (!attempt.ok) expect(attempt.reason).toBe("completed_is_final");
    }
  });

  it("voiding an abandoned cart puts the garment back on the shelf", async () => {
    const locationId = await freshLocation("VOID");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 3 });
    const transaction = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 3,
      unitPriceMinorUnits: 7000,
    });
    expect(
      (await ledger.balanceFor({ retailerId, variantId, locationId }))
        .available,
    ).toBe(0);

    const voided = await pos.voidTransaction({
      retailerId,
      transactionId: transaction.id,
      locationId,
      voidReason: "Client changed their mind at the till.",
    });
    expect(voided.ok).toBe(true);

    const after = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    // An abandoned cart must not keep stock off the shelf.
    expect(after.available).toBe(3);
    expect(after.onHand).toBe(3);
  });

  it("REFUSES a void with no reason, in the database", async () => {
    const locationId = await freshLocation("NOREASON");
    const bad = await admin.from("pos_transactions").insert({
      retailer_id: retailerId,
      location_id: locationId,
      state: "voided",
    });
    expect(bad.error?.code).toBe(CHECK_VIOLATION);
  });

  it("REFUSES a completed transaction with no completion time", async () => {
    const locationId = await freshLocation("NOTIME");
    const bad = await admin.from("pos_transactions").insert({
      retailer_id: retailerId,
      location_id: locationId,
      state: "completed",
    });
    expect(bad.error?.code).toBe(CHECK_VIOLATION);
  });

  it("REFUSES an RTW line with no item attached", async () => {
    const locationId = await freshLocation("NOVARIANT");
    const transaction = await pos.openTransaction({ retailerId, locationId });
    const bad = await admin.from("pos_transaction_lines").insert({
      retailer_id: retailerId,
      transaction_id: transaction.id,
      kind: "rtw",
      quantity: 1,
      unit_price_minor_units: 1000,
    });
    expect(bad.error?.code).toBe(CHECK_VIOLATION);
  });

  it("REFUSES a payment for a provider ADR-062 has not activated", async () => {
    const locationId = await freshLocation("NOPROV");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({ retailerId, locationId });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 4200,
    });

    // ACTIVATED_PAYMENT_PROVIDERS is empty until a money decision exists, so
    // every capture is refused. That is correct behaviour, not a bug.
    const refused = await pos.capturePayment({
      retailerId,
      transactionId: transaction.id,
      provider: "some_psp",
      providerReference: "ref-1",
      amountMinorUnits: 4200,
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("provider_not_activated");
  });

  it("REJECTS the whole capture when a card-shaped field is present", async () => {
    const locationId = await freshLocation("CARD");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({ retailerId, locationId });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 4200,
    });

    // Even with the provider explicitly activated, card data poisons the
    // call. Dropping the field silently would teach the caller it was kept.
    const refused = await pos.capturePayment({
      retailerId,
      transactionId: transaction.id,
      provider: "test_terminal",
      providerReference: "ref-2",
      amountMinorUnits: 4200,
      activatedProviders: ["test_terminal"],
      rawFieldNames: ["amount", "card_number"],
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("card_data_not_accepted");
  });

  it("REFUSES a capture whose amount does not match the cart", async () => {
    const locationId = await freshLocation("MISMATCH");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({ retailerId, locationId });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 4200,
    });

    const refused = await pos.capturePayment({
      retailerId,
      transactionId: transaction.id,
      provider: "test_terminal",
      providerReference: "ref-3",
      amountMinorUnits: 4199,
      activatedProviders: ["test_terminal"],
    });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.reason).toBe("amount_mismatch");
  });

  it("records a matching capture and refuses the retry as a duplicate", async () => {
    const locationId = await freshLocation("CAPTURE");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({ retailerId, locationId });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 4200,
    });

    const reference = `pi-${RUN}`;
    const captured = await pos.capturePayment({
      retailerId,
      transactionId: transaction.id,
      provider: "test_terminal",
      providerReference: reference,
      amountMinorUnits: 4200,
      activatedProviders: ["test_terminal"],
    });
    expect(captured.ok).toBe(true);

    // A retried terminal callback must reconcile, not double-charge.
    const duplicate = await admin.from("pos_payments").insert({
      retailer_id: retailerId,
      transaction_id: transaction.id,
      provider: "test_terminal",
      provider_reference: reference,
      amount_minor_units: 4200,
    });
    expect(duplicate.error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("REFUSES an UPDATE to a recorded payment", async () => {
    const { data: payment } = await admin
      .from("pos_payments")
      .select("id")
      .eq("retailer_id", retailerId)
      .limit(1)
      .maybeSingle();
    if (!payment) return;

    const attempt = await admin
      .from("pos_payments")
      .update({ amount_minor_units: 1 })
      .eq("id", payment.id)
      .select("id");
    const changedNothing =
      attempt.error !== null || (attempt.data?.length ?? 0) === 0;
    expect(changedNothing).toBe(true);
  });

  it("returns a garment as a NEW linked transaction and restocks it", async () => {
    const locationId = await freshLocation("RETURN");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 4 });

    const sale = await pos.openTransaction({ retailerId, locationId, staffId });
    const added = await pos.addLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 2,
      unitPriceMinorUnits: 12000,
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    await pos.takeCashAndComplete({
      retailerId,
      transactionId: sale.id,
      locationId,
      staffId,
    });
    expect(
      (await ledger.balanceFor({ retailerId, variantId, locationId })).onHand,
    ).toBe(2);

    const returned = await pos.returnLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      lineId: added.lineId,
      requestedOn: new Date().toISOString(),
      staffId,
    });
    expect(returned.ok).toBe(true);
    if (!returned.ok) return;
    expect(returned.restocked).toBe(2);
    expect(returned.refundMinorUnits).toBe(24000);

    // Back on the shelf.
    expect(
      (await ledger.balanceFor({ retailerId, variantId, locationId })).onHand,
    ).toBe(4);

    // The return is its own transaction, pointing at the original. The
    // original sale row is untouched, so the sale still happened.
    const { data: returnRow } = await admin
      .from("pos_transactions")
      .select("returns_transaction_id, state")
      .eq("id", returned.returnTransactionId)
      .single();
    expect(returnRow!.returns_transaction_id).toBe(sale.id);

    const { data: original } = await admin
      .from("pos_transactions")
      .select("state")
      .eq("id", sale.id)
      .single();
    expect(original!.state).toBe("completed");

    // And a second return of the same unit is refused.
    const again = await pos.returnLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      lineId: added.lineId,
      requestedOn: new Date().toISOString(),
    });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reason).toBe("already_returned");
  });

  it("REFUSES to return bespoke MTM at all, and a performed service", async () => {
    const locationId = await freshLocation("BESPOKE");
    const sale = await pos.openTransaction({ retailerId, locationId, staffId });

    const mtm = await pos.addLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      kind: "mtm",
      quantity: 1,
      unitPriceMinorUnits: 180000,
    });
    const service = await pos.addLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      kind: "alteration_service",
      quantity: 1,
      unitPriceMinorUnits: 4500,
    });
    expect(mtm.ok && service.ok).toBe(true);
    if (!mtm.ok || !service.ok) return;

    await pos.takeCashAndComplete({
      retailerId,
      transactionId: sale.id,
      locationId,
    });

    // A garment cut to one person has no second buyer.
    const mtmReturn = await pos.returnLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      lineId: mtm.lineId,
      requestedOn: new Date().toISOString(),
    });
    expect(mtmReturn.ok).toBe(false);
    if (!mtmReturn.ok) expect(mtmReturn.reason).toBe("mtm_is_bespoke");

    // The labour already happened.
    const performed = await pos.returnLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      lineId: service.lineId,
      requestedOn: new Date().toISOString(),
      servicePerformed: true,
    });
    expect(performed.ok).toBe(false);
    if (!performed.ok) {
      expect(performed.reason).toBe("service_already_performed");
    }

    // An unperformed one is refundable, and restocks nothing.
    const unperformed = await pos.returnLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      lineId: service.lineId,
      requestedOn: new Date().toISOString(),
      servicePerformed: false,
    });
    expect(unperformed.ok).toBe(true);
    if (unperformed.ok) {
      expect(unperformed.restocked).toBe(0);
      expect(unperformed.refundMinorUnits).toBe(4500);
    }
  });

  it("keeps a mixed cart's kinds apart instead of netting them", async () => {
    const locationId = await freshLocation("MIXED");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const sale = await pos.openTransaction({ retailerId, locationId, staffId });

    await pos.addLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 12000,
    });
    await pos.addLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      kind: "alteration_service",
      quantity: 1,
      unitPriceMinorUnits: 4500,
    });
    await pos.addLine({
      retailerId,
      transactionId: sale.id,
      locationId,
      kind: "mtm",
      quantity: 1,
      unitPriceMinorUnits: 180000,
    });

    const loaded = await pos.load({ retailerId, transactionId: sale.id });
    expect(loaded!.totals.subtotalMinorUnits).toBe(196500);
    // A refund decision needs the kinds separately, so they stay separate.
    expect(loaded!.totals.byKindMinorUnits).toEqual({
      rtw: 12000,
      alteration_service: 4500,
      mtm: 180000,
    });
  });

  it("REFUSES to complete a cart nobody paid for, and moves no stock", async () => {
    const locationId = await freshLocation("UNPAID");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 3 });
    const transaction = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 3,
      unitPriceMinorUnits: 12000,
    });

    const attempt = await pos.completeSale({
      retailerId,
      transactionId: transaction.id,
      locationId,
    });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("payment_incomplete");

    // The refusal must not half-move stock: still held, never sold.
    const balance = await ledger.balanceFor({
      retailerId,
      variantId,
      locationId,
    });
    expect(balance.onHand).toBe(3);
    expect(balance.reserved).toBe(3);
  });

  it("REFUSES to complete on a part payment", async () => {
    const locationId = await freshLocation("PARTIAL");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({ retailerId, locationId });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 12000,
    });

    const part = await pos.capturePayment({
      retailerId,
      transactionId: transaction.id,
      provider: "cash",
      providerReference: `part-${RUN}`,
      amountMinorUnits: 5000,
      // Cash needs no activation, but a short payment is still short.
    });
    // The capture itself is refused, because it does not match the cart.
    expect(part.ok).toBe(false);
    if (!part.ok) expect(part.reason).toBe("amount_mismatch");

    const attempt = await pos.completeSale({
      retailerId,
      transactionId: transaction.id,
      locationId,
    });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("payment_incomplete");
  });

  it("takes CASH with no processor activated at all", async () => {
    const locationId = await freshLocation("CASH");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 2 });
    const transaction = await pos.openTransaction({
      retailerId,
      locationId,
      staffId,
    });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 2,
      unitPriceMinorUnits: 12000,
    });

    // ACTIVATED_PAYMENT_PROVIDERS is empty. A shop still has to trade.
    const closed = await pos.takeCashAndComplete({
      retailerId,
      transactionId: transaction.id,
      locationId,
      staffId,
    });
    expect(closed.ok).toBe(true);

    const { data: payments } = await admin
      .from("pos_payments")
      .select("provider, amount_minor_units")
      .eq("transaction_id", transaction.id);
    expect(payments).toHaveLength(1);
    expect(payments![0]!.provider).toBe("cash");
    expect(payments![0]!.amount_minor_units).toBe(24000);

    // And the sale genuinely travelled awaiting_payment -> completed.
    const { data: row } = await admin
      .from("pos_transactions")
      .select("state, completed_at")
      .eq("id", transaction.id)
      .single();
    expect(row!.state).toBe("completed");
    expect(row!.completed_at).not.toBeNull();
  });

  it("REFUSES a second cash tender for the same sale", async () => {
    const locationId = await freshLocation("DOUBLECASH");
    await ledger.receive({ retailerId, variantId, locationId, quantity: 1 });
    const transaction = await pos.openTransaction({ retailerId, locationId });
    await pos.addLine({
      retailerId,
      transactionId: transaction.id,
      locationId,
      kind: "rtw",
      variantId,
      quantity: 1,
      unitPriceMinorUnits: 8000,
    });
    expect(
      (
        await pos.capturePayment({
          retailerId,
          transactionId: transaction.id,
          provider: "cash",
          amountMinorUnits: 8000,
        })
      ).ok,
    ).toBe(true);

    // The derived cash reference is per transaction, so a re-recorded tender
    // collides instead of doubling the day's takings.
    const again = await admin.from("pos_payments").insert({
      retailer_id: retailerId,
      transaction_id: transaction.id,
      provider: "cash",
      provider_reference: `cash:${transaction.id}`,
      amount_minor_units: 8000,
    });
    expect(again.error?.code).toBe(UNIQUE_VIOLATION);
  });

  it("REFUSES to take payment for an empty cart", async () => {
    const locationId = await freshLocation("EMPTY");
    const transaction = await pos.openTransaction({ retailerId, locationId });
    const attempt = await pos.transition({
      retailerId,
      transactionId: transaction.id,
      to: "awaiting_payment",
    });
    expect(attempt.ok).toBe(false);
    if (!attempt.ok) expect(attempt.reason).toBe("empty_cart");
  });
});
