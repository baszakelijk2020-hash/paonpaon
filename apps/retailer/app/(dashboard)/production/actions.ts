"use server";

import {
  MeasurementMonitorRepository,
  OrderRepository,
  ProductionPieceRepository,
  RetailerRepository,
  RetailerStaffRepository,
  InternalCommunityRepository,
} from "@paon/database";
import type { PieceKind, PieceStage } from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireModuleSession } from "@/lib/module-session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface ProductionActionState {
  formError?: string;
  notice?: string;
}

async function resolveActingStaff() {
  const session = await requireModuleSession(
    "garment_service_operations",
    "mutate",
  );
  const supabase = await getSupabaseServerClient();
  const staff = await new RetailerStaffRepository(supabase).findByUserId(
    session.userId,
  );
  if (!staff) throw new Error("No staff record for this session.");
  return { session, supabase, staff };
}

export async function createSpec(
  _previous: ProductionActionState,
  formData: FormData,
): Promise<ProductionActionState> {
  const { session, supabase } = await resolveActingStaff();
  const orderId = String(formData.get("orderId") ?? "").trim();

  const order = await new OrderRepository(supabase).findById(orderId as never);
  if (!order) return { formError: "Order not found." };

  const version = await new MeasurementMonitorRepository(
    supabase,
  ).latestApprovedVersion({ customerId: order.customerId });
  if (!version) {
    return {
      formError:
        "This client has no approved measurements yet — approve a measurement version first.",
    };
  }

  await new ProductionPieceRepository(supabase).createSpec({
    retailerId: session.retailerId,
    orderId,
    customerId: order.customerId,
    measurementVersionId: version.id,
  });
  revalidatePath("/production");
  return { notice: "Spec created." };
}

export async function addPiece(
  _previous: ProductionActionState,
  formData: FormData,
): Promise<ProductionActionState> {
  const { session, supabase } = await resolveActingStaff();
  const specId = String(formData.get("specId") ?? "").trim();
  const pieceKind = String(formData.get("pieceKind") ?? "") as PieceKind;
  const pieceSequence = Number(formData.get("pieceSequence") ?? 1);
  const promisedOn =
    (formData.get("promisedOn") as string | null)?.trim() || undefined;

  const repo = new ProductionPieceRepository(supabase);
  const specs = await repo.findSpecsByRetailer({
    retailerId: session.retailerId,
  });
  const spec = specs.find((s) => s.id === specId);
  if (!spec) return { formError: "Spec not found." };

  const order = await new OrderRepository(supabase).findById(
    spec.order_id as never,
  );
  if (!order) return { formError: "Order not found." };
  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  if (!retailer) return { formError: "Retailer not found." };

  await repo.addPiece({
    retailerId: session.retailerId,
    specId,
    orderId: spec.order_id,
    orderNumber: order.orderNumber,
    retailerCode: retailer.slug,
    pieceKind,
    pieceSequence,
    ...(promisedOn ? { promisedOn } : {}),
  });
  revalidatePath("/production");
  return { notice: "Piece added." };
}

const STAGE_REJECTION_MESSAGES: Record<string, string> = {
  transition_not_allowed: "That move isn't allowed from the current stage.",
  rework_requires_defect:
    "Say what the defect was — a rework with no stated defect teaches nobody anything.",
  quality_control_requires_inspector: "Name who inspected it.",
  inspector_cannot_be_maker:
    "The inspector can't be the same person who made it — that's self-assessment, not QC.",
  dispatch_requires_all_pieces_ready:
    "Every piece on this order must be ready before dispatch.",
};

export async function transitionStage(
  _previous: ProductionActionState,
  formData: FormData,
): Promise<ProductionActionState> {
  const { session, staff, supabase } = await resolveActingStaff();
  const pieceId = String(formData.get("pieceId") ?? "");
  const to = String(formData.get("to") ?? "") as PieceStage;
  const defectNote =
    (formData.get("defectNote") as string | null)?.trim() || undefined;
  const inspectorStaffId =
    (formData.get("inspectorStaffId") as string | null)?.trim() || undefined;

  const result = await new ProductionPieceRepository(supabase).transitionStage({
    retailerId: session.retailerId,
    pieceId,
    to,
    recordedByStaffId: staff.id,
    ...(defectNote ? { defectNote } : {}),
    ...(inspectorStaffId ? { inspectorStaffId } : {}),
  });
  if (!result.ok) {
    return {
      formError:
        STAGE_REJECTION_MESSAGES[result.reason] ??
        "That move could not be recorded.",
    };
  }

  revalidatePath("/production");
  return { notice: "Updated." };
}

const AMENDMENT_REJECTION_MESSAGES: Record<string, string> = {
  spec_immutable_after_cut:
    "This piece has already dispatched — no further change is possible.",
  amendment_requires_reason: "Say why this is changing.",
  amendment_requires_cost_decision: "Decide who absorbs the cost.",
};

export async function amendSpec(
  _previous: ProductionActionState,
  formData: FormData,
): Promise<ProductionActionState> {
  const { session, staff, supabase } = await resolveActingStaff();
  const specId = String(formData.get("specId") ?? "").trim();
  const pieceId = String(formData.get("pieceId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const costDecision = String(formData.get("costDecision") ?? "") as
    "retailer_absorbs" | "customer_pays" | "supplier_credit";

  const repo = new ProductionPieceRepository(supabase);
  const pieces = await repo.findPiecesBySpec(specId);
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return { formError: "Piece not found." };

  const result = await repo.amendSpec({
    retailerId: session.retailerId,
    specId,
    pieceStage: piece.stage as PieceStage,
    reason,
    costDecision,
    amendedByStaffId: staff.id,
  });
  if (!result.ok) {
    return {
      formError:
        AMENDMENT_REJECTION_MESSAGES[result.reason] ??
        "That amendment could not be recorded.",
    };
  }

  revalidatePath("/production");
  return { notice: "Amendment recorded." };
}

export async function issueWorkTicket(
  _previous: ProductionActionState,
  formData: FormData,
): Promise<ProductionActionState> {
  const { session, supabase } = await resolveActingStaff();
  const pieceId = String(formData.get("pieceId") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const dueOn = String(formData.get("dueOn") ?? "").trim();
  const outworkerReference =
    (formData.get("outworkerReference") as string | null)?.trim() || undefined;

  await new ProductionPieceRepository(supabase).issueWorkTicket({
    retailerId: session.retailerId,
    pieceId,
    instructions,
    dueOn,
    ...(outworkerReference ? { outworkerReference } : {}),
  });
  revalidatePath("/production");
  return { notice: "Ticket issued." };
}

/**
 * Raises a service-recovery budget request for a delayed piece's order —
 * the real "service-recovery action" the item's Acceptance line names,
 * reusing PHASE 11.4's authorisation record rather than inventing a
 * second, parallel one. Moves no money.
 */
export async function raiseDelayServiceRecovery(
  _previous: ProductionActionState,
  formData: FormData,
): Promise<ProductionActionState> {
  const { session, staff, supabase } = await resolveActingStaff();
  const pieceId = String(formData.get("pieceId") ?? "").trim();
  const daysLate = Number(formData.get("daysLate") ?? 0);

  const repo = new ProductionPieceRepository(supabase);
  const pieces = await repo.findPiecesByRetailer({
    retailerId: session.retailerId,
  });
  const piece = pieces.find((p) => p.id === pieceId);
  if (!piece) return { formError: "Piece not found." };

  const order = await new OrderRepository(supabase).findById(
    piece.order_id as never,
  );
  if (!order) return { formError: "Order not found." };

  const result = await new InternalCommunityRepository(
    supabase,
  ).requestServiceRecoveryBudget({
    retailerId: session.retailerId,
    requestedByStaffId: staff.id,
    amountMinorUnits: 2000,
    perRequestCapMinorUnits: 25_000,
    reason: `Production running ${daysLate} day(s) late on order ${order.orderNumber} (piece ${piece.barcode}).`,
    orderId: piece.order_id,
    customerId: order.customerId,
  });
  if (!result.ok) {
    return { formError: "That could not be recorded." };
  }

  revalidatePath("/production");
  return { notice: "Service recovery request submitted." };
}
