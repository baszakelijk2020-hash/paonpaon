/**
 * Serialized production pieces (INV-103 / PHASE 12.2).
 *
 * A "piece" is one physically separable garment component that moves
 * through the workroom on its own: a jacket, trousers, a waistcoat. The
 * item's acceptance criterion — "jacket/trousers scan independently" — is
 * the whole reason pieces exist rather than a single order-level status.
 * A two-piece suit whose trousers are finished and whose jacket is in
 * rework is a real and common state that an order-level status cannot
 * represent without lying about one of them.
 *
 * Two rules do the load-bearing work:
 *
 * 1. A production spec pins an immutable measurement version (Stage 12.1)
 *    and is itself immutable once cutting starts. `checkSpecChange`
 *    refuses a silent post-cut edit and forces it to be an explicit,
 *    recorded amendment with a stated cost consequence.
 * 2. Stage transitions are a directed graph with named exits, not a free
 *    text field. Rework is a first-class edge back, not a status people
 *    overwrite.
 */

/**
 * Physically separable components. Every entry is deliberately also a
 * member of `GARMENT_CATEGORIES` in ./production — a test pins that — so
 * the two vocabularies cannot drift into disagreeing about what a jacket
 * is. The list is a strict subset: "suit" and "accessories" are garment
 * categories but not separable pieces.
 */
export const PIECE_KINDS = [
  "jacket",
  "trousers",
  "waistcoat",
  "shirt",
  "overcoat",
] as const;
export type PieceKind = (typeof PIECE_KINDS)[number];

/**
 * In-house workroom stages for one piece.
 *
 * Deliberately NOT the same thing as `PieceStage` in ./production,
 * which is a connector-facing mirror of an external manufacturer's status
 * (GoCreate remains authoritative there). This is our own workroom's
 * lifecycle for a piece we are making, and it has states an external
 * mirror does not — `fitting_basted`, `rework` — precisely because we can
 * observe them. Two names for two different facts, rather than one name
 * quietly meaning both.
 */
export const PIECE_STAGES = [
  "spec_locked",
  "cutting",
  "assembly",
  "fitting_basted",
  "finishing",
  "quality_control",
  "rework",
  "ready",
  "dispatched",
] as const;
export type PieceStage = (typeof PIECE_STAGES)[number];

/**
 * Allowed transitions. `rework` deliberately re-enters at `assembly`
 * rather than at the stage it came from: something has to be undone, and
 * pretending a reworked piece resumes exactly where it failed is how a QC
 * failure gets marked ready without anyone touching it.
 */
const STAGE_GRAPH: Readonly<Record<PieceStage, readonly PieceStage[]>> = {
  spec_locked: ["cutting"],
  cutting: ["assembly"],
  assembly: ["fitting_basted", "finishing"],
  fitting_basted: ["assembly", "finishing"],
  finishing: ["quality_control"],
  quality_control: ["ready", "rework"],
  rework: ["assembly"],
  ready: ["dispatched"],
  dispatched: [],
};

export type StageTransitionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "transition_not_allowed"
        | "rework_requires_defect"
        | "quality_control_requires_inspector"
        | "inspector_cannot_be_maker"
        | "dispatch_requires_all_pieces_ready";
    };

export function checkStageTransition(args: {
  readonly from: PieceStage;
  readonly to: PieceStage;
  readonly defectNote?: string;
  readonly inspectorStaffId?: string;
  readonly makerStaffId?: string;
}): StageTransitionCheck {
  if (!STAGE_GRAPH[args.from].includes(args.to)) {
    return { ok: false, reason: "transition_not_allowed" };
  }
  if (args.to === "rework" && (args.defectNote ?? "").trim().length === 0) {
    // A rework with no stated defect cannot be learned from, and the
    // supplier/workroom conversation later has nothing to point at.
    return { ok: false, reason: "rework_requires_defect" };
  }
  if (args.from === "quality_control") {
    if (!args.inspectorStaffId) {
      return { ok: false, reason: "quality_control_requires_inspector" };
    }
    if (args.inspectorStaffId === args.makerStaffId) {
      // Separation of duties. Someone inspecting their own work is not
      // quality control, it is self-assessment.
      return { ok: false, reason: "inspector_cannot_be_maker" };
    }
  }
  return { ok: true };
}

/** A dispatch is an order-level event even though stages are per piece. */
export function checkOrderDispatch(args: {
  readonly pieceStages: readonly PieceStage[];
}): StageTransitionCheck {
  const allReady = args.pieceStages.every(
    (stage) => stage === "ready" || stage === "dispatched",
  );
  return allReady
    ? { ok: true }
    : { ok: false, reason: "dispatch_requires_all_pieces_ready" };
}

/**
 * Barcode identity. Deliberately derived from the piece id rather than a
 * separate counter: a second sequence is a second truth, and a mislabelled
 * jacket is very hard to detect downstream.
 */
export function buildPieceBarcode(args: {
  readonly retailerCode: string;
  readonly orderNumber: string;
  readonly pieceKind: PieceKind;
  readonly pieceSequence: number;
}): string {
  const kind = args.pieceKind.slice(0, 3).toUpperCase();
  const sequence = String(args.pieceSequence).padStart(2, "0");
  return `${args.retailerCode}-${args.orderNumber}-${kind}${sequence}`;
}

export type BarcodeParse =
  | {
      readonly ok: true;
      readonly retailerCode: string;
      readonly orderNumber: string;
      readonly pieceKindPrefix: string;
      readonly pieceSequence: number;
    }
  | { readonly ok: false; readonly reason: "malformed" };

export function parsePieceBarcode(barcode: string): BarcodeParse {
  const match = /^([A-Z0-9]+)-([A-Z0-9-]+)-([A-Z]{3})(\d{2})$/.exec(
    barcode.trim().toUpperCase(),
  );
  if (!match) return { ok: false, reason: "malformed" };
  return {
    ok: true,
    retailerCode: match[1]!,
    orderNumber: match[2]!,
    pieceKindPrefix: match[3]!,
    pieceSequence: Number(match[4]),
  };
}

export type SpecChangeCheck =
  | { readonly ok: true; readonly requiresAmendment: boolean }
  | {
      readonly ok: false;
      readonly reason:
        | "spec_immutable_after_cut"
        | "amendment_requires_reason"
        | "amendment_requires_cost_decision";
    };

/**
 * "Post-cut change is explicit." Before cutting, a spec edit is ordinary.
 * Once cloth has been cut, the spec cannot be edited at all — the change
 * becomes an amendment that must name a reason and a decision about who
 * absorbs the cost. Silently editing the spec would leave the cut cloth
 * and the record disagreeing, with nothing recording that anyone knew.
 */
export function checkSpecChange(args: {
  readonly stage: PieceStage;
  readonly reason?: string;
  readonly costDecision?:
    "retailer_absorbs" | "customer_pays" | "supplier_credit";
}): SpecChangeCheck {
  const beforeCut = args.stage === "spec_locked";
  if (beforeCut) return { ok: true, requiresAmendment: false };
  if (args.stage === "dispatched") {
    return { ok: false, reason: "spec_immutable_after_cut" };
  }
  if ((args.reason ?? "").trim().length === 0) {
    return { ok: false, reason: "amendment_requires_reason" };
  }
  if (!args.costDecision) {
    return { ok: false, reason: "amendment_requires_cost_decision" };
  }
  return { ok: true, requiresAmendment: true };
}

export interface MaterialConsumption {
  readonly materialKey: string;
  readonly plannedUnits: number;
  readonly consumedUnits: number;
  readonly unit: "metre" | "piece";
}

export interface MaterialReconciliation {
  readonly materialKey: string;
  readonly varianceUnits: number;
  readonly overConsumed: boolean;
}

/**
 * Reconciles planned against consumed. Reports variance in both
 * directions: under-consumption is as much a signal as over-consumption
 * (it usually means the BOM is wrong, which quietly mis-costs every future
 * garment of that pattern).
 */
export function reconcileMaterials(
  lines: readonly MaterialConsumption[],
): readonly MaterialReconciliation[] {
  return lines
    .map((line) => ({
      materialKey: line.materialKey,
      varianceUnits: Number(
        (line.consumedUnits - line.plannedUnits).toFixed(4),
      ),
      overConsumed: line.consumedUnits > line.plannedUnits,
    }))
    .filter((line) => line.varianceUnits !== 0);
}

/**
 * What an outworker is allowed to see. The item requires a minimized
 * identity, so this returns the fields and nothing else — a whitelist,
 * not a redaction pass. A redaction pass fails open when a new field is
 * added; a whitelist fails closed.
 */
export interface OutworkerTicket {
  readonly barcode: string;
  readonly pieceKind: PieceKind;
  readonly stage: PieceStage;
  readonly instructions: string;
  readonly dueOn: string;
  /** Initials only. Enough to route a question, not to identify a client. */
  readonly customerInitials: string;
}

export function buildOutworkerTicket(args: {
  readonly barcode: string;
  readonly pieceKind: PieceKind;
  readonly stage: PieceStage;
  readonly instructions: string;
  readonly dueOn: string;
  readonly customerFullName: string;
}): OutworkerTicket {
  const initials = args.customerFullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return {
    barcode: args.barcode,
    pieceKind: args.pieceKind,
    stage: args.stage,
    instructions: args.instructions,
    dueOn: args.dueOn,
    customerInitials: initials,
  };
}

export interface DelayAssessment {
  readonly delayed: boolean;
  readonly daysLate: number;
  /** True when the delay is large enough that saying nothing is worse than
   * saying something. Drives a service-recovery action, not a silent flag. */
  readonly requiresServiceRecovery: boolean;
}

const SERVICE_RECOVERY_THRESHOLD_DAYS = 3;

export function assessDelay(args: {
  readonly promisedOn: string;
  readonly asOf: string;
  readonly completedOn?: string;
}): DelayAssessment {
  const reference = args.completedOn ?? args.asOf;
  const daysLate = Math.floor(
    (Date.parse(reference) - Date.parse(args.promisedOn)) /
      (1000 * 60 * 60 * 24),
  );
  if (daysLate <= 0) {
    return { delayed: false, daysLate: 0, requiresServiceRecovery: false };
  }
  return {
    delayed: true,
    daysLate,
    requiresServiceRecovery: daysLate >= SERVICE_RECOVERY_THRESHOLD_DAYS,
  };
}
