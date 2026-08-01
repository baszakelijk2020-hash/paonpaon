/**
 * Loss prevention and the RFID pilot (INV-104 / INV-105 / PHASE 13.2).
 *
 * The non-goal here is the sharpest in Stage 13: **no employee accusation
 * score**. That is not implemented as a policy note. There is no function
 * in this module that takes a staff id and returns a number, and
 * `summarizeRiskCoverage` deliberately reports on *adjustments* and
 * *locations*, never on people. A risk rule fires on a transaction shape,
 * not on who performed it.
 *
 * The second constraint is that an RFID sweep never posts a balance.
 * `reconcileSweep` returns observations and discrepancies; the only way
 * stock moves is a human-made count adjustment through Stage 13.1's
 * ledger, which already requires a reason and a count session.
 */

export const RISK_RULE_KINDS = [
  "high_value_adjustment",
  "repeated_adjustment_same_variant",
  "adjustment_outside_count_session",
  "large_manual_discount",
] as const;
export type RiskRuleKind = (typeof RISK_RULE_KINDS)[number];

export interface RiskAssessment {
  readonly triggered: readonly RiskRuleKind[];
  readonly requiresIndependentApproval: boolean;
  readonly rationale: string;
}

/**
 * Assesses one adjustment against the rules. Every input is a property of
 * the *transaction* — value, repetition, whether a count session was open.
 * None of them is an identity. That is what keeps this a control and not a
 * suspicion engine.
 */
export function assessAdjustmentRisk(args: {
  readonly valueMinorUnits: number;
  readonly highValueThresholdMinorUnits: number;
  readonly priorAdjustmentsSameVariant: number;
  readonly withinCountSession: boolean;
  readonly manualDiscountBasisPoints?: number;
  readonly discountThresholdBasisPoints?: number;
}): RiskAssessment {
  const triggered: RiskRuleKind[] = [];
  if (args.valueMinorUnits >= args.highValueThresholdMinorUnits) {
    triggered.push("high_value_adjustment");
  }
  if (args.priorAdjustmentsSameVariant >= 3) {
    triggered.push("repeated_adjustment_same_variant");
  }
  if (!args.withinCountSession) {
    triggered.push("adjustment_outside_count_session");
  }
  if (
    args.manualDiscountBasisPoints !== undefined &&
    args.manualDiscountBasisPoints >=
      (args.discountThresholdBasisPoints ?? 3000)
  ) {
    triggered.push("large_manual_discount");
  }
  return {
    triggered,
    requiresIndependentApproval: triggered.length > 0,
    rationale:
      triggered.length === 0
        ? "No risk rule matched"
        : `Matched: ${triggered.join(", ")}`,
  };
}

export type ApprovalCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "independent_approval_required"
        | "self_approval_not_allowed"
        | "approver_lacks_authority";
    };

/**
 * Separation of duties on a flagged adjustment. The approver must be a
 * different person AND hold manager authority. Either alone is
 * insufficient: a peer approving a peer is not independence, and the same
 * manager approving their own adjustment is not a second pair of eyes.
 */
export function checkAdjustmentApproval(args: {
  readonly assessment: RiskAssessment;
  readonly requestedByStaffId: string;
  readonly approverStaffId?: string;
  readonly approverIsManager: boolean;
}): ApprovalCheck {
  if (!args.assessment.requiresIndependentApproval) return { ok: true };
  if (!args.approverStaffId) {
    return { ok: false, reason: "independent_approval_required" };
  }
  if (args.approverStaffId === args.requestedByStaffId) {
    return { ok: false, reason: "self_approval_not_allowed" };
  }
  if (!args.approverIsManager) {
    return { ok: false, reason: "approver_lacks_authority" };
  }
  return { ok: true };
}

export interface EpcObservation {
  /** Electronic Product Code read from a tag. */
  readonly epc: string;
  readonly zoneKey: string;
  readonly observedAt: string;
  /** 0–1 from the reader. */
  readonly readConfidence: number;
}

export interface SweepReconciliation {
  /** EPCs seen at least once above the confidence floor. */
  readonly presentEpcs: readonly string[];
  /** Expected on the floor and not observed. NOT "missing": a tag can be
   * unread for a dozen mundane reasons, and calling it missing invites a
   * write-off. */
  readonly unobservedEpcs: readonly string[];
  /** Observed but not expected here — usually mis-shelved, occasionally a
   * transfer nobody recorded. */
  readonly unexpectedEpcs: readonly string[];
  /** Reads below the confidence floor, kept so a low-confidence sweep is
   * visibly low-confidence rather than looking like a clean one. */
  readonly lowConfidenceReadCount: number;
  /** Always false. See the module docblock and the test that pins it. */
  readonly postsBalanceChange: false;
}

const READ_CONFIDENCE_FLOOR = 0.8;

/**
 * Reconciles a sweep against what the ledger expects to be in the zone.
 * Deduplicates repeated reads of the same tag — a reader passing the same
 * jacket four times has seen one jacket, and counting four is how an RFID
 * pilot produces a phantom surplus on day one.
 */
export function reconcileSweep(args: {
  readonly observations: readonly EpcObservation[];
  readonly expectedEpcs: readonly string[];
  readonly zoneKey: string;
  readonly confidenceFloor?: number;
}): SweepReconciliation {
  const floor = args.confidenceFloor ?? READ_CONFIDENCE_FLOOR;
  const inZone = args.observations.filter(
    (observation) => observation.zoneKey === args.zoneKey,
  );
  const confident = inZone.filter(
    (observation) => observation.readConfidence >= floor,
  );
  const presentEpcs = [...new Set(confident.map((o) => o.epc))].sort();
  const expected = new Set(args.expectedEpcs);
  const present = new Set(presentEpcs);

  return {
    presentEpcs,
    unobservedEpcs: [...expected].filter((epc) => !present.has(epc)).sort(),
    unexpectedEpcs: presentEpcs.filter((epc) => !expected.has(epc)),
    lowConfidenceReadCount: inZone.length - confident.length,
    postsBalanceChange: false,
  };
}

export type FalsePositiveResolution =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "resolution_note_required" | "not_an_open_discrepancy";
    };

/**
 * Closing a sweep discrepancy. Requires a note because "resolved" with no
 * explanation is indistinguishable from "ignored", and a pilot judged on
 * unexplained resolutions will look far more accurate than it is.
 */
export function resolveSweepDiscrepancy(args: {
  readonly open: boolean;
  readonly resolutionNote: string;
}): FalsePositiveResolution {
  if (!args.open) return { ok: false, reason: "not_an_open_discrepancy" };
  if (args.resolutionNote.trim().length < 5) {
    return { ok: false, reason: "resolution_note_required" };
  }
  return { ok: true };
}

export interface RiskCoverage {
  readonly flaggedAdjustmentCount: number;
  readonly awaitingApprovalCount: number;
  readonly locationsWithOpenFlags: readonly string[];
}

/**
 * Reports on adjustments and locations. Note what it cannot report: there
 * is no staff id anywhere in the input or the output. A "who triggers the
 * most flags" view is the employee accusation score this item forbids, and
 * the way to guarantee it cannot be built from here is to never accept the
 * identity in the first place.
 */
export function summarizeRiskCoverage(args: {
  readonly flags: readonly {
    readonly locationId: string;
    readonly approved: boolean;
  }[];
}): RiskCoverage {
  const awaiting = args.flags.filter((flag) => !flag.approved);
  return {
    flaggedAdjustmentCount: args.flags.length,
    awaitingApprovalCount: awaiting.length,
    locationsWithOpenFlags: [
      ...new Set(awaiting.map((flag) => flag.locationId)),
    ].sort(),
  };
}
