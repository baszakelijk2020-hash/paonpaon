/**
 * Wardrobe lifecycle, longevity guidance, self-scan, and fit freshness
 * (WARD-002, FIT-001–003, LONG-001 / PHASE 4.3 / ADR-016, 055, 063).
 *
 * Self-reported photos/notes and lifecycle events never populate official
 * FittingObservation measurements. PhysicalGarment remains the official
 * fitting/service aggregate.
 */

import type { AppointmentType } from "../appointments/appointment";
import type {
  AppointmentId,
  CustomerId,
  PhysicalGarmentId,
  RetailerId,
  StaffId,
  WardrobeAttachmentId,
  WardrobeItemId,
  WardrobeLifecycleEventId,
  WardrobeSelfScanId,
} from "../shared/branded-id";

import type {
  GarmentCategoryCode,
  WardrobeActorKind,
  WardrobeCareState,
  WardrobeConditionState,
  WardrobeFitPerception,
  WardrobeItem,
  WardrobeWearFrequency,
} from "./wardrobe";

export const WARDROBE_LIFECYCLE_EVENT_KINDS = [
  "worn",
  "rested",
  "cleaned",
  "repaired",
  "care_logged",
  "guidance_dismissed",
] as const;

export type WardrobeLifecycleEventKind =
  (typeof WARDROBE_LIFECYCLE_EVENT_KINDS)[number];

export const WARDROBE_SELF_SCAN_PROVENANCE = "self_reported" as const;

export type WardrobeSelfScanProvenance = typeof WARDROBE_SELF_SCAN_PROVENANCE;

export const WARDROBE_SERVICE_HANDOFF_KINDS = [
  "none",
  "fit_update_appointment",
  "alteration_fitting",
] as const;

export type WardrobeServiceHandoffKind =
  (typeof WARDROBE_SERVICE_HANDOFF_KINDS)[number];

export const WARDROBE_ATTACHMENT_KINDS = ["self_scan", "identifying"] as const;

export type WardrobeAttachmentKind = (typeof WARDROBE_ATTACHMENT_KINDS)[number];

export const FIT_FRESHNESS_STATUSES = [
  "unknown",
  "current",
  "aging",
  "stale",
  "overdue",
] as const;

export type FitFreshnessStatus = (typeof FIT_FRESHNESS_STATUSES)[number];

/** Deterministic thresholds from last official measured/fitting date. */
export const FIT_FRESHNESS_THRESHOLDS_DAYS = {
  currentMax: 180,
  agingMax: 365,
  staleMax: 730,
} as const;

export const LONGEVITY_GUIDANCE_KINDS = [
  "rotate_rest",
  "care_due",
  "cleaning_suggested",
  "repair_suggested",
  "age_stewardship",
] as const;

export type LongevityGuidanceKind = (typeof LONGEVITY_GUIDANCE_KINDS)[number];

export const LONGEVITY_GUIDANCE_SEVERITIES = [
  "info",
  "attention",
  "urgent",
] as const;

export type LongevityGuidanceSeverity =
  (typeof LONGEVITY_GUIDANCE_SEVERITIES)[number];

export interface WardrobeLifecycleEvent {
  readonly id: WardrobeLifecycleEventId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly eventKind: WardrobeLifecycleEventKind;
  readonly actorKind: WardrobeActorKind;
  readonly actorStaffId?: StaffId;
  readonly note?: string;
  readonly guidanceKind?: LongevityGuidanceKind;
  readonly occurredAt: string;
  readonly createdAt: string;
}

export interface WardrobeSelfScan {
  readonly id: WardrobeSelfScanId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly notes?: string;
  readonly sizeChangeReported: boolean;
  readonly fitPerceptionAtScan?: WardrobeFitPerception;
  /** Always self_reported — never an official FittingObservation. */
  readonly provenance: WardrobeSelfScanProvenance;
  readonly serviceHandoffKind: WardrobeServiceHandoffKind;
  readonly appointmentId?: AppointmentId;
  readonly appointmentType?: Extract<
    AppointmentType,
    "fitting" | "alteration_fitting"
  >;
  readonly createdByActor: Exclude<WardrobeActorKind, "system">;
  readonly createdByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface WardrobeAttachment {
  readonly id: WardrobeAttachmentId;
  readonly retailerId: RetailerId;
  readonly wardrobeItemId: WardrobeItemId;
  readonly selfScanId?: WardrobeSelfScanId;
  readonly kind: WardrobeAttachmentKind;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly uploadedByActor: Exclude<WardrobeActorKind, "system">;
  readonly uploadedByStaffId?: StaffId;
  readonly createdAt: string;
}

export interface FitFreshnessProjection {
  readonly wardrobeItemId: WardrobeItemId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly lastOfficialMeasuredAt?: string;
  readonly status: FitFreshnessStatus;
  readonly daysSinceMeasured?: number;
  readonly urgencyRank: 0 | 1 | 2 | 3 | 4;
  readonly recommendedAppointmentType?: Extract<
    AppointmentType,
    "fitting" | "alteration_fitting"
  >;
  readonly explanation: string;
  /** Self-reported context shown separately — never official. */
  readonly selfReportedFitPerception?: WardrobeFitPerception;
  readonly selfReportedFitNotes?: string;
}

export interface LongevityGuidanceItem {
  readonly kind: LongevityGuidanceKind;
  readonly severity: LongevityGuidanceSeverity;
  readonly title: string;
  readonly message: string;
  readonly explanation: string;
  readonly dismissible: true;
  /** Explicit non-goal: never coerce replacement. */
  readonly forcesReplacement: false;
}

export interface WardrobeLifecycleState {
  readonly lastWornAt?: string;
  readonly lastRestedAt?: string;
  readonly lastCleanedAt?: string;
  readonly lastRepairedAt?: string;
  readonly dismissedGuidanceKinds: readonly LongevityGuidanceKind[];
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysBetween(earlierIso: string, laterIso: string): number {
  const earlier = Date.parse(earlierIso);
  const later = Date.parse(laterIso);
  if (!Number.isFinite(earlier) || !Number.isFinite(later)) {
    return 0;
  }
  return Math.max(0, Math.floor((later - earlier) / MS_PER_DAY));
}

export function projectLifecycleState(
  events: readonly WardrobeLifecycleEvent[],
): WardrobeLifecycleState {
  let lastWornAt: string | undefined;
  let lastRestedAt: string | undefined;
  let lastCleanedAt: string | undefined;
  let lastRepairedAt: string | undefined;
  const dismissed = new Set<LongevityGuidanceKind>();

  const ordered = [...events].sort((a, b) =>
    a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0,
  );

  for (const event of ordered) {
    switch (event.eventKind) {
      case "worn":
        lastWornAt = event.occurredAt;
        break;
      case "rested":
        lastRestedAt = event.occurredAt;
        break;
      case "cleaned":
        lastCleanedAt = event.occurredAt;
        break;
      case "repaired":
        lastRepairedAt = event.occurredAt;
        break;
      case "guidance_dismissed":
        if (event.guidanceKind) {
          dismissed.add(event.guidanceKind);
        }
        break;
      case "care_logged":
        break;
    }
  }

  return {
    ...(lastWornAt ? { lastWornAt } : {}),
    ...(lastRestedAt ? { lastRestedAt } : {}),
    ...(lastCleanedAt ? { lastCleanedAt } : {}),
    ...(lastRepairedAt ? { lastRepairedAt } : {}),
    dismissedGuidanceKinds: [...dismissed],
  };
}

/**
 * Official last-measured date drives escalating freshness. Self-reported
 * perception/notes are attached for display only (FIT-002, FIT-003).
 */
export function projectFitFreshness(input: {
  readonly wardrobeItemId: WardrobeItemId;
  readonly physicalGarmentId?: PhysicalGarmentId;
  readonly lastOfficialMeasuredAt?: string;
  readonly nowIso: string;
  readonly selfReportedFitPerception?: WardrobeFitPerception;
  readonly selfReportedFitNotes?: string;
}): FitFreshnessProjection {
  const base = {
    wardrobeItemId: input.wardrobeItemId,
    ...(input.physicalGarmentId
      ? { physicalGarmentId: input.physicalGarmentId }
      : {}),
    ...(input.selfReportedFitPerception
      ? { selfReportedFitPerception: input.selfReportedFitPerception }
      : {}),
    ...(input.selfReportedFitNotes
      ? { selfReportedFitNotes: input.selfReportedFitNotes }
      : {}),
  };

  if (!input.lastOfficialMeasuredAt) {
    return {
      ...base,
      status: "unknown",
      urgencyRank: 2,
      recommendedAppointmentType: "fitting",
      explanation:
        "No official fitting observation is recorded for this garment yet. A fit-update appointment keeps measurements garment-scoped.",
    };
  }

  const days = daysBetween(input.lastOfficialMeasuredAt, input.nowIso);
  const measured = {
    ...base,
    lastOfficialMeasuredAt: input.lastOfficialMeasuredAt,
    daysSinceMeasured: days,
  };

  if (days <= FIT_FRESHNESS_THRESHOLDS_DAYS.currentMax) {
    return {
      ...measured,
      status: "current",
      urgencyRank: 0,
      explanation: `Last official measurement was ${days} day${days === 1 ? "" : "s"} ago.`,
    };
  }

  if (days <= FIT_FRESHNESS_THRESHOLDS_DAYS.agingMax) {
    return {
      ...measured,
      status: "aging",
      urgencyRank: 1,
      recommendedAppointmentType: "fitting",
      explanation: `Official fit is aging (${days} days since last measured). A fit-update appointment keeps the record current.`,
    };
  }

  if (days <= FIT_FRESHNESS_THRESHOLDS_DAYS.staleMax) {
    return {
      ...measured,
      status: "stale",
      urgencyRank: 3,
      recommendedAppointmentType: "fitting",
      explanation: `Official fit is stale (${days} days since last measured). Book a fit-update before alterations rely on older observations.`,
    };
  }

  return {
    ...measured,
    status: "overdue",
    urgencyRank: 4,
    recommendedAppointmentType: "fitting",
    explanation: `Official fit is overdue (${days} days since last measured). Schedule a fitting so service work uses current garment observations.`,
  };
}

export function isWardrobeItemSelfScanEligible(
  item: Pick<
    WardrobeItem,
    "condition" | "orderLineId" | "physicalGarmentId" | "ownershipKind"
  >,
): boolean {
  if (item.condition === "retired") {
    return false;
  }
  return (
    item.orderLineId !== undefined ||
    item.physicalGarmentId !== undefined ||
    item.ownershipKind === "retailer_purchased"
  );
}

export type SelfScanEligibilityIssue =
  "retired" | "not_order_line_or_garment_or_purchase";

export function selfScanEligibilityIssues(
  item: Pick<
    WardrobeItem,
    "condition" | "orderLineId" | "physicalGarmentId" | "ownershipKind"
  >,
): readonly SelfScanEligibilityIssue[] {
  const issues: SelfScanEligibilityIssue[] = [];
  if (item.condition === "retired") {
    issues.push("retired");
  }
  if (
    item.orderLineId === undefined &&
    item.physicalGarmentId === undefined &&
    item.ownershipKind !== "retailer_purchased"
  ) {
    issues.push("not_order_line_or_garment_or_purchase");
  }
  return issues;
}

/**
 * Self-scan may trigger appointment/alteration handoff but never writes
 * official FittingObservation rows (ADR-016/055/063).
 */
export function recommendFitServiceHandoff(input: {
  readonly sizeChangeReported: boolean;
  readonly fitPerception?: WardrobeFitPerception;
  readonly freshnessStatus: FitFreshnessStatus;
  readonly notes?: string;
}): {
  readonly serviceHandoffKind: WardrobeServiceHandoffKind;
  readonly appointmentType?: Extract<
    AppointmentType,
    "fitting" | "alteration_fitting"
  >;
  readonly provenance: WardrobeSelfScanProvenance;
  readonly writesOfficialObservation: false;
  readonly advisorContext: string;
} {
  const needsAlteration =
    input.sizeChangeReported ||
    input.fitPerception === "needs_alteration" ||
    input.fitPerception === "slightly_tight" ||
    input.fitPerception === "slightly_loose";

  const freshnessNeedsFit =
    input.freshnessStatus === "aging" ||
    input.freshnessStatus === "stale" ||
    input.freshnessStatus === "overdue" ||
    input.freshnessStatus === "unknown";

  if (needsAlteration) {
    const advisorContext = [
      "Self-reported fit context (not an official measurement).",
      input.sizeChangeReported ? "Customer reported a size change." : null,
      input.fitPerception
        ? `Perceived fit: ${input.fitPerception.replaceAll("_", " ")}.`
        : null,
      input.notes ? `Notes: ${input.notes}` : null,
    ]
      .filter((part): part is string => part !== null)
      .join(" ");

    return {
      serviceHandoffKind: "alteration_fitting",
      appointmentType: "alteration_fitting",
      provenance: WARDROBE_SELF_SCAN_PROVENANCE,
      writesOfficialObservation: false,
      advisorContext,
    };
  }

  if (freshnessNeedsFit || (input.notes !== undefined && input.notes !== "")) {
    return {
      serviceHandoffKind: "fit_update_appointment",
      appointmentType: "fitting",
      provenance: WARDROBE_SELF_SCAN_PROVENANCE,
      writesOfficialObservation: false,
      advisorContext: [
        "Self-reported wear photo/notes for a fit-update conversation.",
        input.notes ? `Notes: ${input.notes}` : null,
        `Official freshness: ${input.freshnessStatus}.`,
      ]
        .filter((part): part is string => part !== null)
        .join(" "),
    };
  }

  return {
    serviceHandoffKind: "none",
    provenance: WARDROBE_SELF_SCAN_PROVENANCE,
    writesOfficialObservation: false,
    advisorContext:
      "Self-scan recorded for advisor context only; no service handoff required.",
  };
}

export function buildWardrobeEvidenceObjectPath(params: {
  readonly retailerId: RetailerId | string;
  readonly wardrobeItemId: WardrobeItemId | string;
  readonly objectName: string;
}): string {
  const safeName = params.objectName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${params.retailerId}/${params.wardrobeItemId}/${safeName || "scan"}`;
}

export function isSecureWardrobeEvidencePath(params: {
  readonly storagePath: string;
  readonly retailerId: RetailerId | string;
  readonly wardrobeItemId: WardrobeItemId | string;
}): boolean {
  const prefix = `${params.retailerId}/${params.wardrobeItemId}/`;
  if (!params.storagePath.startsWith(prefix)) {
    return false;
  }
  const remainder = params.storagePath.slice(prefix.length);
  return remainder.length > 0 && !remainder.includes("..");
}

/**
 * Respectful longevity guidance from age/wear/rest/care/cleaning/repair.
 * Never suggests forced replacement (LONG-001).
 */
export function deriveLongevityGuidance(input: {
  readonly categoryCode: GarmentCategoryCode;
  readonly condition: WardrobeConditionState;
  readonly careState: WardrobeCareState;
  readonly wearFrequency?: WardrobeWearFrequency;
  readonly acquiredAt?: string;
  readonly lifecycle: WardrobeLifecycleState;
  readonly nowIso: string;
}): readonly LongevityGuidanceItem[] {
  const dismissed = new Set(input.lifecycle.dismissedGuidanceKinds);
  const items: LongevityGuidanceItem[] = [];

  const push = (item: LongevityGuidanceItem) => {
    if (!dismissed.has(item.kind)) {
      items.push(item);
    }
  };

  if (input.careState === "due_soon" || input.careState === "needs_attention") {
    push({
      kind: "care_due",
      severity: input.careState === "needs_attention" ? "urgent" : "attention",
      title: "Care attention",
      message:
        input.careState === "needs_attention"
          ? "This piece needs care attention when you are ready."
          : "Care will be due soon — plan cleaning or pressing at your pace.",
      explanation:
        "Guidance follows the garment's recorded care state. It is dismissible and never requires replacement.",
      dismissible: true,
      forcesReplacement: false,
    });
  }

  if (input.condition === "needs_care" || input.condition === "fair") {
    push({
      kind: "repair_suggested",
      severity: "attention",
      title: "Repair before wear intensifies",
      message:
        "A small repair or atelier check can extend the life of this garment.",
      explanation:
        "Condition suggests stewardship through repair or cleaning, not planned obsolescence.",
      dismissible: true,
      forcesReplacement: false,
    });
  }

  const rotationSensitive =
    input.categoryCode === "suit" ||
    input.categoryCode === "jacket" ||
    input.categoryCode === "trousers" ||
    input.categoryCode === "shirt" ||
    input.categoryCode === "formalwear" ||
    input.categoryCode === "leather";

  if (
    rotationSensitive &&
    (input.wearFrequency === "frequently" ||
      input.wearFrequency === "regularly")
  ) {
    const lastWorn = input.lifecycle.lastWornAt;
    const lastRested = input.lifecycle.lastRestedAt;
    const recentWearWithoutRest =
      lastWorn !== undefined &&
      (lastRested === undefined || lastRested < lastWorn) &&
      daysBetween(lastWorn, input.nowIso) < 3;

    if (recentWearWithoutRest || lastWorn === undefined) {
      push({
        kind: "rotate_rest",
        severity: "info",
        title: "Rotate and rest",
        message:
          "Give this piece a rest day between wears so fabric and shape recover.",
        explanation:
          "Rotation guidance supports longevity for suits, shirts, and shoes — not a prompt to replace.",
        dismissible: true,
        forcesReplacement: false,
      });
    }
  }

  const lastCleaned = input.lifecycle.lastCleanedAt ?? input.acquiredAt;
  if (
    lastCleaned !== undefined &&
    daysBetween(lastCleaned, input.nowIso) >= 120 &&
    input.careState !== "in_service"
  ) {
    push({
      kind: "cleaning_suggested",
      severity: "info",
      title: "Cleaning when convenient",
      message:
        "It has been a while since the last recorded clean — schedule care when it suits you.",
      explanation:
        "Cleaning suggestions are optional stewardship signals derived from lifecycle history.",
      dismissible: true,
      forcesReplacement: false,
    });
  }

  if (input.acquiredAt !== undefined) {
    const ageDays = daysBetween(input.acquiredAt, input.nowIso);
    if (ageDays >= 365) {
      const years = Math.floor(ageDays / 365);
      push({
        kind: "age_stewardship",
        severity: "info",
        title: "Longevity stewardship",
        message: `This garment is about ${years} year${years === 1 ? "" : "s"} in your wardrobe — care and rotation keep it serviceable.`,
        explanation:
          "Age is shown for stewardship context only. There is no forced replacement mechanic.",
        dismissible: true,
        forcesReplacement: false,
      });
    }
  }

  return items;
}

export function wardrobeSelfScanNeverWritesOfficialObservation(
  scan: Pick<WardrobeSelfScan, "provenance">,
): boolean {
  return (
    scan.provenance === WARDROBE_SELF_SCAN_PROVENANCE &&
    recommendFitServiceHandoff({
      sizeChangeReported: false,
      freshnessStatus: "current",
    }).writesOfficialObservation === false
  );
}

/** Narrow helper for tests and UI labels. */
export function fitFreshnessLabel(status: FitFreshnessStatus): string {
  switch (status) {
    case "unknown":
      return "Not officially measured";
    case "current":
      return "Fit current";
    case "aging":
      return "Fit aging";
    case "stale":
      return "Fit stale";
    case "overdue":
      return "Fit overdue";
  }
}
