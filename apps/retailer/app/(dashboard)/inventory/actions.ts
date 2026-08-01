"use server";

import { requireRetailerRole } from "@paon/auth";
import { RetailerStaffRepository, StockLedgerRepository } from "@paon/database";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface InventoryActionState {
  formError?: string;
  notice?: string;
}

/**
 * NOT exported — a "use server" module may only export async functions, and
 * Next.js rejects the whole module at invocation time with an opaque digest
 * if it does not. The browser then shows no error and the form silently
 * does nothing.
 */
const REJECTION_MESSAGES: Record<string, string> = {
  insufficient_available:
    "Not enough available to hold. Some of this stock is already promised to someone.",
  quantity_not_positive: "Enter a whole number greater than zero.",
  same_location: "Choose two different locations.",
  no_count_session: "Open a stock count before adjusting.",
  recount_outstanding:
    "The variance is large enough to need a recount first. Count it again before writing anything off.",
  reason_required:
    "Say what happened — an unexplained adjustment is indistinguishable from shrinkage.",
  adjustment_exceeds_variance:
    "That is more than the count actually found. Adjust by the counted difference or recount.",
};

function message(reason: string): string {
  return REJECTION_MESSAGES[reason] ?? "That could not be recorded.";
}

async function context() {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "sales_associate");
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  return {
    session,
    repo: new StockLedgerRepository(supabase),
    staffId: staff?.id,
  };
}

function quantityFrom(formData: FormData, field = "quantity"): number {
  return Number(formData.get(field) ?? 0);
}

/** Goods in. Appends a receipt; never writes a balance. */
export async function receiveStock(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const quantity = quantityFrom(formData);

  if (!variantId || !locationId)
    return { formError: "Choose an item and a location." };
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { formError: message("quantity_not_positive") };
  }

  await repo.receive({
    retailerId: session.retailerId,
    variantId,
    locationId,
    quantity,
    ...(staffId ? { recordedByStaffId: staffId } : {}),
  });
  revalidatePath("/inventory");
  return { notice: `Received ${quantity}.` };
}

/** Holds stock. Refused when availability, not on-hand, is short. */
export async function holdStock(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const quantity = quantityFrom(formData);

  const result = await repo.reserve({
    retailerId: session.retailerId,
    variantId,
    locationId,
    quantity,
    ...(staffId ? { recordedByStaffId: staffId } : {}),
  });
  if (!result.ok) return { formError: message(result.reason) };

  revalidatePath("/inventory");
  return { notice: `Holding ${quantity}.` };
}

/** Two entries, so in-transit stock stays visible. */
export async function transferStock(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const fromLocationId = String(formData.get("fromLocationId") ?? "").trim();
  const toLocationId = String(formData.get("toLocationId") ?? "").trim();
  const quantity = quantityFrom(formData);

  const result = await repo.transfer({
    retailerId: session.retailerId,
    variantId,
    fromLocationId,
    toLocationId,
    quantity,
    ...(staffId ? { recordedByStaffId: staffId } : {}),
  });
  if (!result.ok) return { formError: message(result.reason) };

  revalidatePath("/inventory");
  return { notice: `Moved ${quantity}.` };
}

/** Undo. Appends a reversal citing the original; edits nothing. */
export async function reverseEntry(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  const entryId = String(formData.get("entryId") ?? "").trim();
  if (!entryId) return { formError: "Nothing selected to undo." };

  await repo.reverse({
    retailerId: session.retailerId,
    entryId,
    ...(staffId ? { recordedByStaffId: staffId } : {}),
  });
  revalidatePath("/inventory");
  return {
    notice: "Undone. Both the original and the correction stay on record.",
  };
}

export async function openCount(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  requireRetailerRole(session.retailerRole, "manager");
  const locationId = String(formData.get("locationId") ?? "").trim();
  if (!locationId || !staffId) return { formError: "Choose a location." };

  await repo.openCountSession({
    retailerId: session.retailerId,
    locationId,
    openedByStaffId: staffId,
    blind: true,
  });
  revalidatePath("/inventory");
  return { notice: "Count open. Record what you physically see." };
}

/** Records what was counted. Re-recording corrects, never doubles. */
export async function recordCount(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const countedQuantity = quantityFrom(formData, "countedQuantity");

  if (!sessionId || !variantId) return { formError: "Choose an item." };
  if (!Number.isInteger(countedQuantity) || countedQuantity < 0) {
    return { formError: "Enter a whole number, zero or more." };
  }

  await repo.recordCountLine({
    retailerId: session.retailerId,
    sessionId,
    variantId,
    countedQuantity,
    ...(staffId ? { countedByStaffId: staffId } : {}),
  });
  revalidatePath("/inventory");
  return { notice: `Counted ${countedQuantity}.` };
}

/** The only path that changes a balance, and it demands a reason. */
export async function adjustFromCount(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo, staffId } = await context();
  requireRetailerRole(session.retailerRole, "manager");

  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const variantId = String(formData.get("variantId") ?? "").trim();
  const adjustmentQuantity = quantityFrom(formData, "adjustmentQuantity");
  const reason = String(formData.get("reason") ?? "");

  if (!sessionId || !locationId || !variantId) {
    return { formError: "Missing count details." };
  }

  const result = await repo.adjustFromCount({
    retailerId: session.retailerId,
    sessionId,
    locationId,
    variantId,
    adjustmentQuantity,
    reason,
    ...(staffId ? { recordedByStaffId: staffId } : {}),
  });
  if (!result.ok) return { formError: message(result.reason) };

  revalidatePath("/inventory");
  return { notice: "Adjustment recorded against the count." };
}

export async function closeCount(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const { session, repo } = await context();
  requireRetailerRole(session.retailerRole, "manager");
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  if (!sessionId) return { formError: "No count selected." };

  await repo.closeCountSession({
    retailerId: session.retailerId,
    sessionId,
    state: "reconciled",
  });
  revalidatePath("/inventory");
  return { notice: "Count closed." };
}
