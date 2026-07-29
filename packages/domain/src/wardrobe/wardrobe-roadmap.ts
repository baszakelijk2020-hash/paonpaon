/**
 * Wardrobe Roadmap plans, goals, ranked gaps, and staged priorities
 * (ROAD-001, ADR-063 / PHASE 4.2).
 */

import type {
  CustomerId,
  KnowledgeObjectId,
  MetadataConceptId,
  ProductId,
  RetailerId,
  StaffId,
  WardrobeGapId,
  WardrobeItemId,
  WardrobeRoadmapGoalId,
  WardrobeRoadmapId,
} from "../shared/branded-id";
import type { Timestamps } from "../shared/timestamps";

import type { OutfitSlotKind } from "./outfit";

export const WARDROBE_ROADMAP_STATUSES = [
  "draft",
  "proposed",
  "approved",
  "archived",
] as const;

export type WardrobeRoadmapStatus = (typeof WARDROBE_ROADMAP_STATUSES)[number];

export const WARDROBE_ROADMAP_STATUS_TRANSITIONS: Readonly<
  Record<WardrobeRoadmapStatus, readonly WardrobeRoadmapStatus[]>
> = {
  draft: ["proposed", "draft", "archived"],
  proposed: ["approved", "draft", "archived"],
  approved: ["approved", "archived"],
  archived: ["archived"],
};

export const WARDROBE_GAP_STATUSES = ["open", "filled", "deferred"] as const;

export type WardrobeGapStatus = (typeof WARDROBE_GAP_STATUSES)[number];

export interface WardrobeRoadmapGoal {
  readonly id: WardrobeRoadmapGoalId;
  readonly roadmapId: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly title: string;
  readonly description?: string;
  readonly rank: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WardrobeGap {
  readonly id: WardrobeGapId;
  readonly roadmapId: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly title: string;
  readonly description?: string;
  readonly slotKind: OutfitSlotKind;
  readonly rank: number;
  readonly stagePriority: number;
  readonly status: WardrobeGapStatus;
  readonly conceptId?: MetadataConceptId;
  readonly productId?: ProductId;
  readonly wardrobeItemId?: WardrobeItemId;
  readonly knowledgeObjectId?: KnowledgeObjectId;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WardrobeRoadmap extends Timestamps {
  readonly id: WardrobeRoadmapId;
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly title: string;
  readonly summary?: string;
  readonly horizonLabel?: string;
  readonly status: WardrobeRoadmapStatus;
  readonly createdByStaffId: StaffId;
  readonly approvedAt?: string;
  readonly approvedByStaffId?: StaffId;
  readonly goals: readonly WardrobeRoadmapGoal[];
  readonly gaps: readonly WardrobeGap[];
}

export interface AdvisorBriefWardrobeGap {
  readonly gapId: WardrobeGapId;
  readonly title: string;
  readonly slotKind: OutfitSlotKind;
  readonly rank: number;
  readonly stagePriority: number;
  readonly status: WardrobeGapStatus;
  readonly ruleTitle?: string;
  readonly suggestedProductLabel?: string;
}

export function canTransitionRoadmapStatus(
  from: WardrobeRoadmapStatus,
  to: WardrobeRoadmapStatus,
): boolean {
  return WARDROBE_ROADMAP_STATUS_TRANSITIONS[from].includes(to);
}

export function canCustomerViewRoadmap(roadmap: WardrobeRoadmap): boolean {
  return roadmap.status === "approved";
}

export function projectAdvisorBriefWardrobeGaps(
  roadmap: WardrobeRoadmap | null,
  labels: {
    readonly ruleTitles: ReadonlyMap<string, string>;
    readonly productLabels: ReadonlyMap<string, string>;
  },
): readonly AdvisorBriefWardrobeGap[] {
  if (!roadmap || roadmap.status !== "approved") {
    return [];
  }
  return [...roadmap.gaps]
    .filter((gap) => gap.status === "open")
    .sort((a, b) => a.rank - b.rank || a.stagePriority - b.stagePriority)
    .map((gap) => ({
      gapId: gap.id,
      title: gap.title,
      slotKind: gap.slotKind,
      rank: gap.rank,
      stagePriority: gap.stagePriority,
      status: gap.status,
      ...(gap.knowledgeObjectId
        ? {
            ruleTitle:
              labels.ruleTitles.get(gap.knowledgeObjectId) ??
              "Approved styling rule",
          }
        : {}),
      ...(gap.productId
        ? {
            suggestedProductLabel:
              labels.productLabels.get(gap.productId) ?? "Catalogue suggestion",
          }
        : {}),
    }));
}
