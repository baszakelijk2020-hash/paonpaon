/**
 * MeasurementMonitor decision gate (FIT-101–FIT-103 / PHASE 12.1).
 *
 * The whole point of this module is what it refuses to do. A self-scan
 * never writes a customer's approved measurements. It produces a
 * *candidate* with a quality assessment and a *decision* — one of
 * no-action, advisor-review or remeasure — and an advisor is the only
 * thing that can turn a candidate into a new approved version. There is
 * deliberately no `applyCandidate`, no `autoApprove` and no tolerance
 * setting that unlocks one.
 *
 * The reason is not caution for its own sake. An approved measurement set
 * is what a garment gets cut to. Silently drifting it by 4mm because a
 * phone camera said so produces a suit that does not fit and no record of
 * why.
 *
 * Approved versions are immutable and append-only. Stage 12.2's production
 * spec pins a `measurementVersionId`, so a measurement that could be
 * edited in place would retroactively change what a garment was supposedly
 * cut to.
 */

export const CAPTURE_METHODS = [
  "tailor_tape",
  "guided_self_scan",
  "imported_record",
  "garment_derived",
] as const;
export type CaptureMethod = (typeof CAPTURE_METHODS)[number];

/**
 * Stated in code because the item's non-goal is explicit: no claim of
 * single-photo accuracy equivalence. Every value carries the method that
 * produced it so a downstream reader can weigh it, and the UI is expected
 * to show this rather than present all numbers as equally authoritative.
 */
export const SELF_SCAN_ACCURACY_NOTE =
  "A guided self-scan is a candidate for review, not a measurement of " +
  "record. It never replaces an approved value without an advisor.";

export interface MeasurementValue {
  readonly key: string;
  /** Millimetres. Integers only — a tenth of a millimetre is false
   * precision from any capture method available here. */
  readonly millimetres: number;
  readonly capturedBy: CaptureMethod;
}

export interface MeasurementVersion {
  readonly versionId: string;
  readonly customerId: string;
  readonly version: number;
  readonly approvedByStaffId: string;
  readonly approvedAt: string;
  readonly values: readonly MeasurementValue[];
}

export const SCAN_QUALITY_FAILURES = [
  "insufficient_captures",
  "pose_confidence_low",
  "landmarks_incomplete",
  "scale_reference_missing",
] as const;
export type ScanQualityFailure = (typeof SCAN_QUALITY_FAILURES)[number];

export interface ScanQualitySignals {
  readonly captureCount: number;
  /** 0–1 from the capture client. */
  readonly poseConfidence: number;
  readonly landmarksDetected: number;
  readonly landmarksExpected: number;
  readonly hasScaleReference: boolean;
}

export type ScanQualityAssessment =
  | { readonly ok: true }
  | { readonly ok: false; readonly failures: readonly ScanQualityFailure[] };

const MIN_CAPTURES = 2;
const MIN_POSE_CONFIDENCE = 0.7;

/**
 * Returns every reason a scan is unusable, not just the first. A customer
 * who is told "stand further back", fixes that, and is then told "we also
 * need the reference card" has been made to repeat a two-minute process
 * twice for one problem.
 */
export function assessScanQuality(
  signals: ScanQualitySignals,
): ScanQualityAssessment {
  const failures: ScanQualityFailure[] = [];
  if (signals.captureCount < MIN_CAPTURES) {
    failures.push("insufficient_captures");
  }
  if (signals.poseConfidence < MIN_POSE_CONFIDENCE) {
    failures.push("pose_confidence_low");
  }
  if (signals.landmarksDetected < signals.landmarksExpected) {
    failures.push("landmarks_incomplete");
  }
  if (!signals.hasScaleReference) {
    // Without a known-size reference in frame, a scan measures proportions,
    // not centimetres.
    failures.push("scale_reference_missing");
  }
  return failures.length === 0 ? { ok: true } : { ok: false, failures };
}

export const MEASUREMENT_DECISIONS = [
  "no_action",
  "advisor_review",
  "remeasure",
] as const;
export type MeasurementDecision = (typeof MEASUREMENT_DECISIONS)[number];

export interface MeasurementDelta {
  readonly key: string;
  readonly approvedMillimetres: number;
  readonly candidateMillimetres: number;
  readonly deltaMillimetres: number;
  readonly withinTolerance: boolean;
}

export interface MeasurementDecisionResult {
  readonly decision: MeasurementDecision;
  readonly deltas: readonly MeasurementDelta[];
  /** Keys present in the approved set but missing from the candidate. A
   * partial scan must not read as "these shrank to zero". */
  readonly missingKeys: readonly string[];
  readonly rationale: string;
  readonly decisionVersion: number;
}

/**
 * The version of the decision rules themselves. Stored with every
 * decision, so re-running an old scan under new rules is visibly a
 * different decision rather than a silent restatement.
 */
export const MEASUREMENT_DECISION_VERSION = 1;

const DEFAULT_TOLERANCE_MM = 10;

/**
 * Compares a candidate against the approved version and returns a
 * decision. Never returns anything that means "apply": the three outcomes
 * are no-action, send to an advisor, or ask the customer to re-measure.
 */
export function decideMeasurementOutcome(args: {
  readonly approved: readonly MeasurementValue[];
  readonly candidate: readonly MeasurementValue[];
  readonly quality: ScanQualityAssessment;
  readonly toleranceMillimetres?: Readonly<Record<string, number>>;
  readonly defaultToleranceMillimetres?: number;
}): MeasurementDecisionResult {
  if (!args.quality.ok) {
    return {
      decision: "remeasure",
      deltas: [],
      missingKeys: [],
      rationale: `Scan quality insufficient: ${args.quality.failures.join(", ")}`,
      decisionVersion: MEASUREMENT_DECISION_VERSION,
    };
  }

  const candidateByKey = new Map(
    args.candidate.map((value) => [value.key, value]),
  );
  const deltas: MeasurementDelta[] = [];
  const missingKeys: string[] = [];
  const fallback = args.defaultToleranceMillimetres ?? DEFAULT_TOLERANCE_MM;

  for (const approvedValue of args.approved) {
    const candidateValue = candidateByKey.get(approvedValue.key);
    if (!candidateValue) {
      // A partial scan is not evidence that a measurement changed.
      missingKeys.push(approvedValue.key);
      continue;
    }
    const delta = candidateValue.millimetres - approvedValue.millimetres;
    const tolerance =
      args.toleranceMillimetres?.[approvedValue.key] ?? fallback;
    deltas.push({
      key: approvedValue.key,
      approvedMillimetres: approvedValue.millimetres,
      candidateMillimetres: candidateValue.millimetres,
      deltaMillimetres: delta,
      withinTolerance: Math.abs(delta) <= tolerance,
    });
  }

  const outOfTolerance = deltas.filter((delta) => !delta.withinTolerance);
  if (outOfTolerance.length === 0) {
    return {
      decision: "no_action",
      deltas,
      missingKeys,
      rationale:
        deltas.length === 0
          ? "No comparable measurements in this scan"
          : `All ${deltas.length} comparable measurements within tolerance`,
      decisionVersion: MEASUREMENT_DECISION_VERSION,
    };
  }

  return {
    decision: "advisor_review",
    deltas,
    missingKeys,
    rationale: outOfTolerance
      .map(
        (delta) =>
          `${delta.key} ${delta.deltaMillimetres > 0 ? "+" : ""}${delta.deltaMillimetres}mm`,
      )
      .join(", "),
    decisionVersion: MEASUREMENT_DECISION_VERSION,
  };
}

export type MeasurementApprovalCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason:
        | "version_not_incremented"
        | "no_values"
        | "duplicate_measurement_key"
        | "non_integer_millimetres"
        | "self_scan_cannot_self_approve"
        | "review_note_required";
    };

/**
 * Guards creation of a new approved version. Two rules do real work here:
 *
 * - A version number that does not advance is refused, because Stage 12.2
 *   pins a `measurementVersionId` and reusing one would change what a
 *   garment was cut to after the fact.
 * - A version whose values came from a self-scan must carry a review note
 *   from a named advisor. "Approved" with no human sentence behind it is
 *   the silent overwrite this item exists to prevent, wearing a signature.
 */
export function checkMeasurementApproval(args: {
  readonly values: readonly MeasurementValue[];
  readonly nextVersion: number;
  readonly latestApprovedVersion?: number;
  readonly approvedByStaffId: string;
  readonly reviewNote?: string;
}): MeasurementApprovalCheck {
  if (args.values.length === 0) return { ok: false, reason: "no_values" };
  if (args.nextVersion <= (args.latestApprovedVersion ?? 0)) {
    return { ok: false, reason: "version_not_incremented" };
  }
  const keys = args.values.map((value) => value.key);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, reason: "duplicate_measurement_key" };
  }
  for (const value of args.values) {
    if (!Number.isInteger(value.millimetres) || value.millimetres <= 0) {
      return { ok: false, reason: "non_integer_millimetres" };
    }
  }
  if (args.approvedByStaffId.trim().length === 0) {
    return { ok: false, reason: "self_scan_cannot_self_approve" };
  }
  const derivedFromScan = args.values.some(
    (value) => value.capturedBy === "guided_self_scan",
  );
  if (derivedFromScan && (args.reviewNote ?? "").trim().length === 0) {
    return { ok: false, reason: "review_note_required" };
  }
  return { ok: true };
}

export interface ReorderGateResult {
  readonly allowed: boolean;
  readonly reason?:
    | "measurement_version_superseded"
    | "open_advisor_review"
    | "no_approved_measurements";
}

/**
 * The reorder gate. A repeat order is the moment a stale measurement does
 * real damage, so it is refused while a review is open or the pinned
 * version has been superseded — the customer is asked to confirm rather
 * than quietly shipped last year's block.
 */
export function checkReorderGate(args: {
  readonly pinnedVersion?: number;
  readonly latestApprovedVersion?: number;
  readonly openAdvisorReviewCount: number;
}): ReorderGateResult {
  if (args.latestApprovedVersion === undefined) {
    return { allowed: false, reason: "no_approved_measurements" };
  }
  if (args.openAdvisorReviewCount > 0) {
    return { allowed: false, reason: "open_advisor_review" };
  }
  if (
    args.pinnedVersion !== undefined &&
    args.pinnedVersion < args.latestApprovedVersion
  ) {
    return { allowed: false, reason: "measurement_version_superseded" };
  }
  return { allowed: true };
}

/**
 * What must happen when a customer deletes the scan a candidate came from.
 * The candidate and its decision are derived data and must go; an already
 * *approved* version does not, because it is a record of a human decision
 * and a garment may have been cut to it. Returning both lists explicitly
 * keeps that distinction in the caller's face rather than in a comment.
 */
export function planScanDeletionRecompute(args: {
  readonly scanId: string;
  readonly candidates: readonly {
    readonly candidateId: string;
    readonly sourceScanId: string;
  }[];
  readonly approvedVersions: readonly {
    readonly versionId: string;
    readonly sourceScanId?: string;
  }[];
}): {
  readonly candidateIdsToDelete: readonly string[];
  readonly approvedVersionIdsToRetain: readonly string[];
} {
  return {
    candidateIdsToDelete: args.candidates
      .filter((candidate) => candidate.sourceScanId === args.scanId)
      .map((candidate) => candidate.candidateId),
    approvedVersionIdsToRetain: args.approvedVersions
      .filter((version) => version.sourceScanId === args.scanId)
      .map((version) => version.versionId),
  };
}
