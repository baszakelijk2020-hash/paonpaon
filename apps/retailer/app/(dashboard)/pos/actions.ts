"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  PosRepository,
  RetailerStaffRepository,
  StockLedgerRepository,
} from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PosActionState {
  formError?: string;
  notice?: string;
}

/**
 * NOT exported — a "use server" module may export only async functions, and
 * Next.js rejects the whole module at invocation with an opaque digest
 * otherwise. The browser then shows nothing at all and the form appears
 * simply not to work.
 *
 * Every message names what happened and what to do about it. Nobody standing
 * at a till with a client in front of them can act on `payment_incomplete`.
 */
const REJECTION_MESSAGES: Record<string, string> = {
  insufficient_available:
    "Not enough available. Some of this stock is already promised to someone else.",
  quantity_not_positive: "Enter a whole number greater than zero.",
  rtw_line_needs_variant: "Choose which item is being sold.",
  completed_is_final:
    "This sale is finished and cannot be changed. To correct it, return the item — that keeps both the sale and the refund on the record.",
  transition_not_allowed: "That is not a step this sale can take from here.",
  void_requires_reason: "Say why the sale is being cancelled.",
  empty_cart: "There is nothing in this sale yet.",
  nothing_to_sell: "There is nothing in this sale yet.",
  not_presented_for_payment:
    "This sale was cancelled. Start a new one rather than reviving it.",
  payment_incomplete:
    "The money for this sale has not been recorded yet. Take payment before finishing.",
  provider_not_activated:
    "Card payment is not switched on yet. Cash works today.",
  provider_reference_required: "A payment needs a reference.",
  provider_reference_conflict:
    "That terminal reference is already attached to another payment. Reconcile it before retrying.",
  amount_mismatch: "That amount does not match the sale total.",
  card_data_not_accepted:
    "Card details are never accepted here. Use the card terminal, then record its reference.",
  not_from_completed_sale: "Only a finished sale can be returned.",
  already_returned: "This item has already been returned.",
  mtm_is_bespoke:
    "Made-to-measure is cut for one person, so it cannot be returned. Book an alteration instead.",
  service_already_performed:
    "The work has already been done, so it cannot be refunded. Discuss a goodwill gesture with a manager.",
  window_expired: "The return window for this item has passed.",
};

function message(reason: string): string {
  return REJECTION_MESSAGES[reason] ?? "That could not be recorded.";
}

async function context() {
  const session = await requireModuleSession("retail_operations");
  requireRetailerRole(session.retailerRole, "sales_associate");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  return {
    session,
    pos: new PosRepository(supabase),
    ledger: new StockLedgerRepository(supabase),
    ...(staff?.id ? { staffId: staff.id } : {}),
  };
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Opens a sale at a till. One open sale per location at a time. */
export async function openSale(
  _previous: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const { session, pos, staffId } = await context();
  const locationId = field(formData, "locationId");
  if (!locationId) return { formError: "Choose a till location." };

  const existing = await pos.findOpenTransaction({
    retailerId: session.retailerId,
    locationId,
  });
  if (existing) {
    revalidatePath("/pos");
    return { notice: "There was already a sale open here." };
  }

  await pos.openTransaction({
    retailerId: session.retailerId,
    locationId,
    ...(staffId ? { staffId } : {}),
  });
  revalidatePath("/pos");
  return { notice: "Sale opened." };
}

/**
 * Adds a line. For a garment this also holds the stock, so the item is
 * genuinely off the shelf while the client decides and a second till cannot
 * promise the same one.
 */
export async function addSaleLine(
  _previous: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const { session, pos } = await context();
  const transactionId = field(formData, "transactionId");
  const locationId = field(formData, "locationId");
  const kind = field(formData, "kind");
  const variantId = field(formData, "variantId");
  const quantity = Number(formData.get("quantity") ?? 0);
  const price = Math.round(Number(formData.get("price") ?? 0) * 100);

  if (!transactionId || !locationId) return { formError: "No sale is open." };
  if (kind !== "rtw" && kind !== "alteration_service" && kind !== "mtm") {
    return { formError: "Choose what is being sold." };
  }
  if (kind === "rtw" && !variantId) {
    return { formError: message("rtw_line_needs_variant") };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { formError: message("quantity_not_positive") };
  }
  if (!Number.isInteger(price) || price <= 0) {
    return { formError: "Enter a price." };
  }

  const added = await pos.addLine({
    retailerId: session.retailerId,
    transactionId,
    locationId,
    kind,
    quantity,
    unitPriceMinorUnits: price,
    ...(variantId ? { variantId } : {}),
  });
  if (!added.ok) return { formError: message(added.reason) };

  revalidatePath("/pos");
  return { notice: "Added to the sale." };
}

/**
 * Takes cash and finishes the sale. Cash is the tender that needs no
 * processor, which is why it is the one the till offers today.
 */
export async function takeCash(
  _previous: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const { session, pos, staffId } = await context();
  const transactionId = field(formData, "transactionId");
  const locationId = field(formData, "locationId");
  if (!transactionId || !locationId) return { formError: "No sale is open." };

  const closed = await pos.takeCashAndComplete({
    retailerId: session.retailerId,
    transactionId,
    locationId,
    ...(staffId ? { staffId } : {}),
  });
  if (!closed.ok) return { formError: message(closed.reason) };

  revalidatePath("/pos");
  return { notice: "Sale finished. Stock updated." };
}

/**
 * Records a card payment taken on the terminal. Refused today because no
 * processor is switched on — the form exists so the refusal is legible
 * rather than the button being mysteriously absent.
 */
export async function recordCardPayment(
  _previous: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const { session, pos } = await context();
  const transactionId = field(formData, "transactionId");
  const reference = field(formData, "reference");
  const provider = field(formData, "provider") || "terminal";
  const amount = Math.round(Number(formData.get("amount") ?? 0) * 100);

  if (!transactionId) return { formError: "No sale is open." };

  const captured = await pos.capturePayment({
    retailerId: session.retailerId,
    transactionId,
    provider,
    providerReference: reference,
    amountMinorUnits: amount,
    // The field names the till would have sent. Passing them is what lets
    // the rule refuse a caller who tried to send card details.
    rawFieldNames: [...formData.keys()],
  });
  if (!captured.ok) return { formError: message(captured.reason) };

  revalidatePath("/pos");
  return { notice: "Payment recorded." };
}

/** Cancels an unfinished sale and puts every held garment back. */
export async function cancelSale(
  _previous: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const { session, pos } = await context();
  const transactionId = field(formData, "transactionId");
  const locationId = field(formData, "locationId");
  const reason = field(formData, "reason");

  if (!transactionId || !locationId) return { formError: "No sale is open." };
  if (!reason) return { formError: message("void_requires_reason") };

  const voided = await pos.voidTransaction({
    retailerId: session.retailerId,
    transactionId,
    locationId,
    voidReason: reason,
  });
  if (!voided.ok) return { formError: message(voided.reason) };

  revalidatePath("/pos");
  return { notice: "Sale cancelled. Everything held is back on the shelf." };
}

/**
 * Returns one line of a finished sale. This never edits the original sale:
 * it writes a new, linked transaction, which is what keeps both the sale and
 * the refund true afterwards.
 */
export async function returnSaleLine(
  _previous: PosActionState,
  formData: FormData,
): Promise<PosActionState> {
  const { session, pos, staffId } = await context();
  const transactionId = field(formData, "transactionId");
  const locationId = field(formData, "locationId");
  const lineId = field(formData, "lineId");
  const servicePerformed = formData.get("servicePerformed") === "on";

  if (!transactionId || !lineId || !locationId) {
    return { formError: "Choose what is being returned." };
  }

  const returned = await pos.returnLine({
    retailerId: session.retailerId,
    transactionId,
    locationId,
    lineId,
    requestedOn: new Date().toISOString(),
    servicePerformed,
    ...(staffId ? { staffId } : {}),
  });
  if (!returned.ok) return { formError: message(returned.reason) };

  revalidatePath("/pos");
  return {
    notice:
      returned.restocked > 0
        ? `Returned. ${returned.restocked} back on the shelf, €${(returned.refundMinorUnits / 100).toFixed(2)} to refund.`
        : `Returned. €${(returned.refundMinorUnits / 100).toFixed(2)} to refund.`,
  };
}
