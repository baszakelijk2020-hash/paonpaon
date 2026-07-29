/**
 * Wardrobe Roadmap persistence with goals, ranked gaps, and staged
 * priorities (PHASE 4.2 / ROAD-001 / ADR-063).
 */

import {
  asId,
  canCustomerViewRoadmap,
  nextRoadmapStatus,
  orderRoadmapStages,
  projectAdvisorBriefWardrobeGaps,
  rankRoadmapGaps,
  roadmapTransitionIssues,
  type AdvisorBriefWardrobeGap,
  type CompatibilityFactCitation,
  type CompatibilityRuleCitation,
  type CreateWardrobeRoadmapInput,
  type CustomerId,
  type GarmentCategoryCode,
  type OutfitSlotKind,
  type RetailerId,
  type RetailerRole,
  type SartorialRelation,
  type StaffId,
  type TransitionWardrobeRoadmapInput,
  type WardrobeRoadmap,
  type WardrobeRoadmapGap,
  type WardrobeRoadmapGoal,
  type WardrobeRoadmapId,
  type WardrobeRoadmapStage,
  type WardrobeRoadmapStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type RoadmapRow = Database["public"]["Tables"]["wardrobe_roadmaps"]["Row"];
type GoalRow = Database["public"]["Tables"]["wardrobe_roadmap_goals"]["Row"];
type GapRow = Database["public"]["Tables"]["wardrobe_roadmap_gaps"]["Row"];
type StageRow = Database["public"]["Tables"]["wardrobe_roadmap_stages"]["Row"];

function parseRuleCitations(value: Json): readonly CompatibilityRuleCitation[] {
  if (!Array.isArray(value)) return [];
  const citations: CompatibilityRuleCitation[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (
      typeof record.ruleId !== "string" ||
      typeof record.ruleTitle !== "string" ||
      typeof record.relation !== "string" ||
      typeof record.explanation !== "string"
    ) {
      continue;
    }
    citations.push({
      ruleId: asId<"SartorialRuleId">(record.ruleId),
      ruleTitle: record.ruleTitle,
      relation: record.relation as SartorialRelation,
      explanation: record.explanation,
    });
  }
  return citations;
}

function parseFactCitations(value: Json): readonly CompatibilityFactCitation[] {
  if (!Array.isArray(value)) return [];
  const citations: CompatibilityFactCitation[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (
      typeof record.sourceKind !== "string" ||
      typeof record.sourceId !== "string" ||
      typeof record.label !== "string" ||
      typeof record.detail !== "string"
    ) {
      continue;
    }
    if (
      record.sourceKind !== "wardrobe_item" &&
      record.sourceKind !== "catalogue_product" &&
      record.sourceKind !== "accepted_concept"
    ) {
      continue;
    }
    citations.push({
      sourceKind: record.sourceKind,
      sourceId: record.sourceId,
      label: record.label,
      detail: record.detail,
    });
  }
  return citations;
}

function toGoal(row: GoalRow): WardrobeRoadmapGoal {
  return {
    id: asId<"WardrobeRoadmapGoalId">(row.id),
    roadmapId: asId<"WardrobeRoadmapId">(row.roadmap_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    displayOrder: row.display_order,
  };
}

function toGap(row: GapRow): WardrobeRoadmapGap {
  return {
    id: asId<"WardrobeRoadmapGapId">(row.id),
    roadmapId: asId<"WardrobeRoadmapId">(row.roadmap_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    rank: row.rank,
    ...(row.slot_kind ? { slotKind: row.slot_kind as OutfitSlotKind } : {}),
    ...(row.category_code
      ? { categoryCode: row.category_code as GarmentCategoryCode }
      : {}),
    ...(row.filled_by_product_id
      ? { filledByProductId: asId<"ProductId">(row.filled_by_product_id) }
      : {}),
    ...(row.filled_by_wardrobe_item_id
      ? {
          filledByWardrobeItemId: asId<"WardrobeItemId">(
            row.filled_by_wardrobe_item_id,
          ),
        }
      : {}),
    ...(row.how_purchase_fills_gap
      ? { howPurchaseFillsGap: row.how_purchase_fills_gap }
      : {}),
  };
}

function toStage(row: StageRow): WardrobeRoadmapStage {
  return {
    id: asId<"WardrobeRoadmapStageId">(row.id),
    roadmapId: asId<"WardrobeRoadmapId">(row.roadmap_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    stageOrder: row.stage_order,
    ...(row.gap_id ? { gapId: asId<"WardrobeRoadmapGapId">(row.gap_id) } : {}),
    ...(row.suggested_product_id
      ? { suggestedProductId: asId<"ProductId">(row.suggested_product_id) }
      : {}),
    ...(row.suggested_wardrobe_item_id
      ? {
          suggestedWardrobeItemId: asId<"WardrobeItemId">(
            row.suggested_wardrobe_item_id,
          ),
        }
      : {}),
    explanation: row.explanation,
    ruleCitations: parseRuleCitations(row.rule_citations),
    factCitations: parseFactCitations(row.fact_citations),
  };
}

function toRoadmap(
  row: RoadmapRow,
  goals: readonly WardrobeRoadmapGoal[],
  gaps: readonly WardrobeRoadmapGap[],
  stages: readonly WardrobeRoadmapStage[],
): WardrobeRoadmap {
  return {
    id: asId<"WardrobeRoadmapId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    title: row.title,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.horizon_label ? { horizonLabel: row.horizon_label } : {}),
    status: row.status as WardrobeRoadmapStatus,
    authoredByStaffId: asId<"StaffId">(row.authored_by_staff_id),
    ...(row.submitted_at ? { submittedAt: row.submitted_at } : {}),
    ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
    ...(row.decided_by_actor
      ? {
          decidedByActor: row.decided_by_actor as "customer" | "advisor",
        }
      : {}),
    ...(row.customer_decision_note
      ? { customerDecisionNote: row.customer_decision_note }
      : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    goals: [...goals].sort((a, b) => a.displayOrder - b.displayOrder),
    gaps: rankRoadmapGaps(gaps),
    stages: orderRoadmapStages(stages),
  };
}

export class WardrobeRoadmapRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: WardrobeRoadmapId): Promise<WardrobeRoadmap | null> {
    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.hydrate(data);
  }

  async findByCustomer(
    customerId: CustomerId,
    options?: { readonly customerVisibleOnly?: boolean },
  ): Promise<WardrobeRoadmap[]> {
    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = options?.customerVisibleOnly
      ? data.filter((row) =>
          canCustomerViewRoadmap(row.status as WardrobeRoadmapStatus),
        )
      : data;

    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async findActiveApprovedGapsForBrief(
    customerId: CustomerId,
  ): Promise<readonly AdvisorBriefWardrobeGap[]> {
    const roadmaps = await this.findByCustomer(customerId);
    const approved = roadmaps.find((roadmap) => roadmap.status === "approved");
    if (!approved) return [];
    return projectAdvisorBriefWardrobeGaps(approved.gaps);
  }

  async createDraft(
    input: CreateWardrobeRoadmapInput,
    authoredByStaffId: StaffId,
  ): Promise<WardrobeRoadmap> {
    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        title: input.title,
        summary: input.summary ?? null,
        horizon_label: input.horizonLabel ?? null,
        status: "draft",
        authored_by_staff_id: authoredByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;

    const { data: goalRows, error: goalError } = await this.client
      .from("wardrobe_roadmap_goals")
      .insert(
        input.goals.map((goal) => ({
          roadmap_id: data.id,
          retailer_id: input.retailerId,
          title: goal.title,
          description: goal.description ?? null,
          display_order: goal.displayOrder,
        })),
      )
      .select("*");
    if (goalError) throw goalError;

    const { data: gapRows, error: gapError } = await this.client
      .from("wardrobe_roadmap_gaps")
      .insert(
        input.gaps.map((gap) => ({
          roadmap_id: data.id,
          retailer_id: input.retailerId,
          title: gap.title,
          description: gap.description ?? null,
          rank: gap.rank,
          slot_kind: gap.slotKind ?? null,
          category_code: gap.categoryCode ?? null,
          filled_by_product_id: gap.filledByProductId ?? null,
          filled_by_wardrobe_item_id: gap.filledByWardrobeItemId ?? null,
          how_purchase_fills_gap: gap.howPurchaseFillsGap ?? null,
        })),
      )
      .select("*");
    if (gapError) throw gapError;

    const gapIdsByIndex = gapRows.map((row) => row.id);

    const { data: stageRows, error: stageError } = await this.client
      .from("wardrobe_roadmap_stages")
      .insert(
        input.stages.map((stage) => ({
          roadmap_id: data.id,
          retailer_id: input.retailerId,
          title: stage.title,
          description: stage.description ?? null,
          stage_order: stage.stageOrder,
          gap_id:
            stage.gapIndex !== undefined
              ? (gapIdsByIndex[stage.gapIndex] ?? null)
              : null,
          suggested_product_id: stage.suggestedProductId ?? null,
          suggested_wardrobe_item_id: stage.suggestedWardrobeItemId ?? null,
          explanation: stage.explanation,
          rule_citations: stage.ruleCitations.map((citation) => ({
            ruleId: citation.ruleId,
            ruleTitle: citation.ruleTitle,
            relation: citation.relation,
            explanation: citation.explanation,
          })),
          fact_citations: stage.factCitations.map((citation) => ({
            sourceKind: citation.sourceKind,
            sourceId: citation.sourceId,
            label: citation.label,
            detail: citation.detail,
          })),
        })),
      )
      .select("*");
    if (stageError) throw stageError;

    return toRoadmap(
      data,
      goalRows.map(toGoal),
      gapRows.map(toGap),
      stageRows.map(toStage),
    );
  }

  async transition(
    input: TransitionWardrobeRoadmapInput,
    actor:
      | {
          readonly kind: "customer";
          readonly customerId: CustomerId;
          readonly retailerId: RetailerId;
        }
      | {
          readonly kind: "advisor";
          readonly retailerId: RetailerId;
          readonly role: RetailerRole;
        },
  ): Promise<WardrobeRoadmap> {
    const existing = await this.findById(
      asId<"WardrobeRoadmapId">(input.roadmapId),
    );
    if (!existing) {
      throw new Error("Wardrobe roadmap not found.");
    }

    const issues = roadmapTransitionIssues({
      action: input.action,
      currentStatus: existing.status,
      roadmapRetailerId: existing.retailerId,
      roadmapCustomerId: existing.customerId,
      goals: existing.goals,
      gaps: existing.gaps,
      stages: existing.stages,
      actor,
    });
    if (issues.length > 0) {
      throw new Error(`Invalid roadmap transition: ${issues.join(", ")}`);
    }

    const nextStatus = nextRoadmapStatus(input.action);
    const now = new Date().toISOString();
    const patch: Database["public"]["Tables"]["wardrobe_roadmaps"]["Update"] = {
      status: nextStatus,
    };

    if (input.action === "submit_for_approval") {
      patch.submitted_at = now;
      patch.decided_at = null;
      patch.decided_by_actor = null;
      patch.customer_decision_note = null;
    }
    if (input.action === "approve" || input.action === "reject") {
      patch.decided_at = now;
      patch.decided_by_actor = "customer";
      patch.customer_decision_note = input.note ?? null;
    }
    if (input.action === "revise_to_draft") {
      patch.submitted_at = null;
      patch.decided_at = null;
      patch.decided_by_actor = null;
      patch.customer_decision_note = null;
    }

    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .update(patch)
      .eq("id", input.roadmapId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return this.hydrate(data);
  }

  private async hydrate(row: RoadmapRow): Promise<WardrobeRoadmap> {
    const roadmapId = row.id;
    const [goalsResult, gapsResult, stagesResult] = await Promise.all([
      this.client
        .from("wardrobe_roadmap_goals")
        .select("*")
        .eq("roadmap_id", roadmapId)
        .order("display_order", { ascending: true }),
      this.client
        .from("wardrobe_roadmap_gaps")
        .select("*")
        .eq("roadmap_id", roadmapId)
        .order("rank", { ascending: true }),
      this.client
        .from("wardrobe_roadmap_stages")
        .select("*")
        .eq("roadmap_id", roadmapId)
        .order("stage_order", { ascending: true }),
    ]);
    if (goalsResult.error) throw goalsResult.error;
    if (gapsResult.error) throw gapsResult.error;
    if (stagesResult.error) throw stagesResult.error;

    return toRoadmap(
      row,
      goalsResult.data.map(toGoal),
      gapsResult.data.map(toGap),
      stagesResult.data.map(toStage),
    );
  }
}
