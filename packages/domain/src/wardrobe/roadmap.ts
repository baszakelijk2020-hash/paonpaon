/**
 * Advisor-authored Wardrobe Roadmap with goals, ranked gaps, and staged
 * priorities (ROAD-001 / PHASE 4.2 / ADR-063). Relationship-scoped only.
 */

import type { RetailerRole } from "../identity/role";
import { retailerRoleAtLeast } from "../identity/role";
import type { GarmentCategoryCode } from "../production/production";
import type {
  CustomerId,
  ProductId,
  RetailerId,
  SartorialRuleId,
  StaffId,
  WardrobeItemId,
  WardrobeRoadmapGapId,
  WardrobeRoadmapGoalId,
  WardrobeRoadmapId,
  WardrobeRoadmapStageId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

import type {
  CompatibilityFactCitation,
  CompatibilityRuleCitation,
  OutfitSlotKind,
} from "./sartorial";

export const WARDROBE_ROADMAP_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "archived",
] as const;

export type WardrobeRoadmapStatus = (typeof WARDROBE_ROADMAP_STATUSES)[number];

export interface WardrobeRoadmapGoal {
  readonly id: WardrobeRoadmapGoalId;
  readonly roadmapId: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly description?: string;
  readonly displayOrder: number;
}

export interface WardrobeRoadmapGap {
  readonly id: WardrobeRoadmapGapId;
  readonly roadmapId: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly description?: string;
  /** Lower rank = higher priority (1 is most important). */
  readonly rank: number;
  readonly slotKind?: OutfitSlotKind;
  readonly categoryCode?: GarmentCategoryCode;
  readonly filledByProductId?: ProductId;
  readonly filledByWardrobeItemId?: WardrobeItemId;
  readonly howPurchaseFillsGap?: string;
}

export interface WardrobeRoadmapStage {
  readonly id: WardrobeRoadmapStageId;
  readonly roadmapId: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly description?: string;
  readonly stageOrder: number;
  readonly gapId?: WardrobeRoadmapGapId;
  readonly suggestedProductId?: ProductId;
  readonly suggestedWardrobeItemId?: WardrobeItemId;
  readonly explanation: string;
  readonly ruleCitations: readonly CompatibilityRuleCitation[];
  readonly factCitations: readonly CompatibilityFactCitation[];
}

export interface WardrobeRoadmap extends Timestamps {
  readonly id: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly title: string;
  readonly summary?: string;
  readonly horizonLabel?: string;
  readonly status: WardrobeRoadmapStatus;
  readonly authoredByStaffId: StaffId;
  readonly submittedAt?: string;
  readonly decidedAt?: string;
  readonly decidedByActor?: "customer" | "advisor";
  readonly customerDecisionNote?: string;
  readonly deletedAt?: string;
  readonly goals: readonly WardrobeRoadmapGoal[];
  readonly gaps: readonly WardrobeRoadmapGap[];
  readonly stages: readonly WardrobeRoadmapStage[];
}

export type RoadmapStatusTransition =
  "submit_for_approval" | "approve" | "reject" | "revise_to_draft" | "archive";

export type RoadmapTransitionIssue =
  | "invalid_from_status"
  | "advisor_only"
  | "customer_only"
  | "cross_tenant"
  | "missing_goal"
  | "missing_gap"
  | "missing_stage"
  | "suggestion_missing_explanation"
  | "suggestion_missing_rule_citation"
  | "suggestion_missing_fact_citation";

export function rankRoadmapGaps(
  gaps: readonly WardrobeRoadmapGap[],
): readonly WardrobeRoadmapGap[] {
  return [...gaps].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.title.localeCompare(b.title);
  });
}

export function orderRoadmapStages(
  stages: readonly WardrobeRoadmapStage[],
): readonly WardrobeRoadmapStage[] {
  return [...stages].sort((a, b) => {
    if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Advisor authors draft/submit/revise/archive; customer approves or rejects
 * pending plans inside the same retailer relationship.
 */
export function roadmapTransitionIssues(params: {
  readonly action: RoadmapStatusTransition;
  readonly currentStatus: WardrobeRoadmapStatus;
  readonly roadmapRetailerId: RetailerId;
  readonly roadmapCustomerId: CustomerId;
  readonly goals: readonly WardrobeRoadmapGoal[];
  readonly gaps: readonly WardrobeRoadmapGap[];
  readonly stages: readonly WardrobeRoadmapStage[];
  readonly actor:
    | {
        readonly kind: "customer";
        readonly customerId: CustomerId;
        readonly retailerId: RetailerId;
      }
    | {
        readonly kind: "advisor";
        readonly retailerId: RetailerId;
        readonly role: RetailerRole;
      }
    | { readonly kind: "other" };
}): readonly RoadmapTransitionIssue[] {
  const issues: RoadmapTransitionIssue[] = [];

  if (params.actor.kind === "other") {
    issues.push("cross_tenant");
    return issues;
  }

  if (params.actor.retailerId !== params.roadmapRetailerId) {
    issues.push("cross_tenant");
    return issues;
  }

  if (params.actor.kind === "customer") {
    if (params.actor.customerId !== params.roadmapCustomerId) {
      issues.push("cross_tenant");
      return issues;
    }
  } else if (!retailerRoleAtLeast(params.actor.role, "sales_associate")) {
    issues.push("advisor_only");
    return issues;
  }

  const advisorActions: readonly RoadmapStatusTransition[] = [
    "submit_for_approval",
    "revise_to_draft",
    "archive",
  ];
  const customerActions: readonly RoadmapStatusTransition[] = [
    "approve",
    "reject",
  ];

  if (
    advisorActions.includes(params.action) &&
    params.actor.kind !== "advisor"
  ) {
    issues.push("advisor_only");
  }
  if (
    customerActions.includes(params.action) &&
    params.actor.kind !== "customer"
  ) {
    issues.push("customer_only");
  }

  const allowedFrom: Record<
    RoadmapStatusTransition,
    readonly WardrobeRoadmapStatus[]
  > = {
    submit_for_approval: ["draft"],
    approve: ["pending_approval"],
    reject: ["pending_approval"],
    revise_to_draft: ["pending_approval", "rejected"],
    archive: ["draft", "approved", "rejected"],
  };

  if (!allowedFrom[params.action].includes(params.currentStatus)) {
    issues.push("invalid_from_status");
  }

  if (params.action === "submit_for_approval") {
    if (params.goals.length === 0) issues.push("missing_goal");
    if (params.gaps.length === 0) issues.push("missing_gap");
    if (params.stages.length === 0) issues.push("missing_stage");

    for (const stage of params.stages) {
      if (!stage.explanation.trim()) {
        issues.push("suggestion_missing_explanation");
      }
      if (stage.ruleCitations.length === 0) {
        issues.push("suggestion_missing_rule_citation");
      }
      if (stage.factCitations.length === 0) {
        issues.push("suggestion_missing_fact_citation");
      }
    }
  }

  return [...new Set(issues)];
}

export function nextRoadmapStatus(
  action: RoadmapStatusTransition,
): WardrobeRoadmapStatus {
  switch (action) {
    case "submit_for_approval":
      return "pending_approval";
    case "approve":
      return "approved";
    case "reject":
      return "rejected";
    case "revise_to_draft":
      return "draft";
    case "archive":
      return "archived";
  }
}

export function canCustomerViewRoadmap(status: WardrobeRoadmapStatus): boolean {
  return (
    status === "pending_approval" ||
    status === "approved" ||
    status === "rejected"
  );
}

export interface AdvisorBriefWardrobeGap {
  readonly gapId: WardrobeRoadmapGapId;
  readonly title: string;
  readonly rank: number;
  readonly howPurchaseFillsGap?: string;
  readonly slotKind?: OutfitSlotKind;
}

export function projectAdvisorBriefWardrobeGaps(
  gaps: readonly WardrobeRoadmapGap[],
): readonly AdvisorBriefWardrobeGap[] {
  return rankRoadmapGaps(gaps).map((gap) => ({
    gapId: gap.id,
    title: gap.title,
    rank: gap.rank,
    ...(gap.howPurchaseFillsGap
      ? { howPurchaseFillsGap: gap.howPurchaseFillsGap }
      : {}),
    ...(gap.slotKind ? { slotKind: gap.slotKind } : {}),
  }));
}

/** Pure helper: stage suggestions must cite at least one accepted rule id. */
export function stageCitesApprovedRules(params: {
  readonly stage: WardrobeRoadmapStage;
  readonly approvedRuleIds: ReadonlySet<SartorialRuleId | string>;
}): boolean {
  if (params.stage.ruleCitations.length === 0) return false;
  return params.stage.ruleCitations.every((citation) =>
    params.approvedRuleIds.has(citation.ruleId),
  );
}
