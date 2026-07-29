/**
 * Wardrobe Roadmap and outfit persistence (PHASE 4.2 / ADR-063).
 */

import {
  asId,
  canTransitionOutfitStatus,
  canTransitionRoadmapStatus,
  type CreateOutfitInput,
  type CreateWardrobeGapInput,
  type CreateWardrobeGoalInput,
  type CreateWardrobeRoadmapInput,
  type CustomerId,
  type Outfit,
  type OutfitRuleCitation,
  type OutfitSlot,
  type OutfitSlotKind,
  type OutfitStatus,
  type RetailerId,
  type StaffId,
  type WardrobeGap,
  type WardrobeGapStatus,
  type WardrobeRoadmap,
  type WardrobeRoadmapGoal,
  type WardrobeRoadmapId,
  type WardrobeRoadmapStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type RoadmapRow = Database["public"]["Tables"]["wardrobe_roadmaps"]["Row"];
type GoalRow = Database["public"]["Tables"]["wardrobe_roadmap_goals"]["Row"];
type GapRow = Database["public"]["Tables"]["wardrobe_gaps"]["Row"];
type OutfitRow = Database["public"]["Tables"]["outfits"]["Row"];
type SlotRow = Database["public"]["Tables"]["outfit_slots"]["Row"];
type CitationRow = Database["public"]["Tables"]["outfit_rule_citations"]["Row"];

function toGoal(row: GoalRow): WardrobeRoadmapGoal {
  return {
    id: asId<"WardrobeRoadmapGoalId">(row.id),
    roadmapId: asId<"WardrobeRoadmapId">(row.roadmap_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    rank: row.rank,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toGap(row: GapRow): WardrobeGap {
  return {
    id: asId<"WardrobeGapId">(row.id),
    roadmapId: asId<"WardrobeRoadmapId">(row.roadmap_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    slotKind: row.slot_kind as OutfitSlotKind,
    rank: row.rank,
    stagePriority: row.stage_priority,
    status: row.status as WardrobeGapStatus,
    ...(row.concept_id
      ? { conceptId: asId<"MetadataConceptId">(row.concept_id) }
      : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    ...(row.knowledge_object_id
      ? {
          knowledgeObjectId: asId<"KnowledgeObjectId">(row.knowledge_object_id),
        }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSlot(row: SlotRow): OutfitSlot {
  return {
    id: asId<"OutfitSlotId">(row.id),
    outfitId: asId<"OutfitId">(row.outfit_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    slotKind: row.slot_kind as OutfitSlotKind,
    sortOrder: row.sort_order,
    displayLabel: row.display_label,
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
  };
}

function toCitation(row: CitationRow): OutfitRuleCitation {
  return {
    id: asId<"OutfitRuleCitationId">(row.id),
    outfitId: asId<"OutfitId">(row.outfit_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    knowledgeObjectId: asId<"KnowledgeObjectId">(row.knowledge_object_id),
    explanation: row.explanation,
    ...(row.slot_kind_a
      ? { slotKindA: row.slot_kind_a as OutfitSlotKind }
      : {}),
    ...(row.slot_kind_b
      ? { slotKindB: row.slot_kind_b as OutfitSlotKind }
      : {}),
    createdAt: row.created_at,
  };
}

function toOutfit(
  row: OutfitRow,
  slots: readonly OutfitSlot[],
  citations: readonly OutfitRuleCitation[],
): Outfit {
  return {
    id: asId<"OutfitId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: row.customer_id,
    ...(row.roadmap_id ? { roadmapId: row.roadmap_id } : {}),
    title: row.title,
    ...(row.occasion_label ? { occasionLabel: row.occasion_label } : {}),
    status: row.status as OutfitStatus,
    createdByStaffId: asId<"StaffId">(row.created_by_staff_id),
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    ...(row.approved_by_staff_id
      ? { approvedByStaffId: asId<"StaffId">(row.approved_by_staff_id) }
      : {}),
    slots,
    ruleCitations: citations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRoadmap(
  row: RoadmapRow,
  goals: readonly WardrobeRoadmapGoal[],
  gaps: readonly WardrobeGap[],
): WardrobeRoadmap {
  return {
    id: asId<"WardrobeRoadmapId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    title: row.title,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.horizon_label ? { horizonLabel: row.horizon_label } : {}),
    status: row.status as WardrobeRoadmapStatus,
    createdByStaffId: asId<"StaffId">(row.created_by_staff_id),
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    ...(row.approved_by_staff_id
      ? { approvedByStaffId: asId<"StaffId">(row.approved_by_staff_id) }
      : {}),
    goals,
    gaps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WardrobeRoadmapRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: WardrobeRoadmapId): Promise<WardrobeRoadmap | null> {
    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.hydrateRoadmap(data);
  }

  async findApprovedByCustomer(
    customerId: CustomerId,
  ): Promise<WardrobeRoadmap | null> {
    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.hydrateRoadmap(data);
  }

  async findByCustomerForAdvisor(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<WardrobeRoadmap[]> {
    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all(data.map((row) => this.hydrateRoadmap(row)));
  }

  async createRoadmap(
    input: CreateWardrobeRoadmapInput,
    createdByStaffId: StaffId,
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
        created_by_staff_id: createdByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toRoadmap(data, [], []);
  }

  async addGoal(input: CreateWardrobeGoalInput): Promise<WardrobeRoadmapGoal> {
    const roadmap = await this.findById(
      asId<"WardrobeRoadmapId">(input.roadmapId),
    );
    if (!roadmap) {
      throw new Error("Roadmap not found.");
    }

    const { data, error } = await this.client
      .from("wardrobe_roadmap_goals")
      .insert({
        roadmap_id: input.roadmapId,
        retailer_id: roadmap.retailerId,
        title: input.title,
        description: input.description ?? null,
        rank: input.rank,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toGoal(data);
  }

  async addGap(
    input: CreateWardrobeGapInput,
    customerId: CustomerId,
  ): Promise<WardrobeGap> {
    const roadmap = await this.findById(
      asId<"WardrobeRoadmapId">(input.roadmapId),
    );
    if (!roadmap) {
      throw new Error("Roadmap not found.");
    }

    const { data, error } = await this.client
      .from("wardrobe_gaps")
      .insert({
        roadmap_id: input.roadmapId,
        retailer_id: roadmap.retailerId,
        customer_id: customerId,
        title: input.title,
        description: input.description ?? null,
        slot_kind: input.slotKind,
        rank: input.rank,
        stage_priority: input.stagePriority,
        status: "open",
        concept_id: input.conceptId ?? null,
        product_id: input.productId ?? null,
        wardrobe_item_id: input.wardrobeItemId ?? null,
        knowledge_object_id: input.knowledgeObjectId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toGap(data);
  }

  async transitionRoadmapStatus(
    retailerId: RetailerId,
    roadmapId: WardrobeRoadmapId,
    status: WardrobeRoadmapStatus,
    staffId?: StaffId,
  ): Promise<WardrobeRoadmap> {
    const existing = await this.findById(roadmapId);
    if (!existing || existing.retailerId !== retailerId) {
      throw new Error("Roadmap not found.");
    }
    if (!canTransitionRoadmapStatus(existing.status, status)) {
      throw new Error(
        `Cannot transition roadmap from ${existing.status} to ${status}.`,
      );
    }

    const patch: Database["public"]["Tables"]["wardrobe_roadmaps"]["Update"] = {
      status,
    };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by_staff_id = staffId ?? null;
    }

    const { data, error } = await this.client
      .from("wardrobe_roadmaps")
      .update(patch)
      .eq("id", roadmapId)
      .eq("retailer_id", retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return this.hydrateRoadmap(data);
  }

  async createOutfit(
    input: CreateOutfitInput,
    createdByStaffId: StaffId,
    ruleExplanations: ReadonlyMap<string, string>,
  ): Promise<Outfit> {
    const { data: outfitRow, error: outfitError } = await this.client
      .from("outfits")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        roadmap_id: input.roadmapId ?? null,
        title: input.title,
        occasion_label: input.occasionLabel ?? null,
        status: "draft",
        created_by_staff_id: createdByStaffId,
      })
      .select("*")
      .single();
    if (outfitError) throw outfitError;

    const slotRows = input.slots.map((slot, index) => ({
      outfit_id: outfitRow.id,
      retailer_id: input.retailerId,
      slot_kind: slot.slotKind,
      sort_order: index,
      display_label: slot.displayLabel,
      wardrobe_item_id: slot.wardrobeItemId ?? null,
      product_id: slot.productId ?? null,
    }));

    const { data: slots, error: slotError } = await this.client
      .from("outfit_slots")
      .insert(slotRows)
      .select("*");
    if (slotError) throw slotError;

    let citations: CitationRow[] = [];
    if (input.knowledgeObjectIds.length > 0) {
      const citationRows = input.knowledgeObjectIds.map(
        (knowledgeObjectId) => ({
          outfit_id: outfitRow.id,
          retailer_id: input.retailerId,
          knowledge_object_id: knowledgeObjectId,
          explanation:
            ruleExplanations.get(knowledgeObjectId) ??
            "Approved styling rule supports this complete look.",
        }),
      );
      const { data: citationData, error: citationError } = await this.client
        .from("outfit_rule_citations")
        .insert(citationRows)
        .select("*");
      if (citationError) throw citationError;
      citations = citationData;
    }

    return toOutfit(outfitRow, slots.map(toSlot), citations.map(toCitation));
  }

  async findOutfitsByCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
    options?: { readonly approvedOnly?: boolean },
  ): Promise<Outfit[]> {
    let query = this.client
      .from("outfits")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (options?.approvedOnly) {
      query = query.eq("status", "approved");
    }
    const { data, error } = await query;
    if (error) throw error;
    return Promise.all(data.map((row) => this.hydrateOutfit(row)));
  }

  async transitionOutfitStatus(
    retailerId: RetailerId,
    outfitId: string,
    status: OutfitStatus,
    staffId?: StaffId,
  ): Promise<Outfit> {
    const { data: existing, error: findError } = await this.client
      .from("outfits")
      .select("*")
      .eq("id", outfitId)
      .eq("retailer_id", retailerId)
      .maybeSingle();
    if (findError) throw findError;
    if (!existing) {
      throw new Error("Outfit not found.");
    }
    if (!canTransitionOutfitStatus(existing.status as OutfitStatus, status)) {
      throw new Error(
        `Cannot transition outfit from ${existing.status} to ${status}.`,
      );
    }

    const patch: Database["public"]["Tables"]["outfits"]["Update"] = { status };
    if (status === "approved") {
      patch.approved_at = new Date().toISOString();
      patch.approved_by_staff_id = staffId ?? null;
    }

    const { data, error } = await this.client
      .from("outfits")
      .update(patch)
      .eq("id", outfitId)
      .eq("retailer_id", retailerId)
      .select("*")
      .single();
    if (error) throw error;
    return this.hydrateOutfit(data);
  }

  private async hydrateRoadmap(row: RoadmapRow): Promise<WardrobeRoadmap> {
    const [goalsResult, gapsResult] = await Promise.all([
      this.client
        .from("wardrobe_roadmap_goals")
        .select("*")
        .eq("roadmap_id", row.id)
        .order("rank", { ascending: true }),
      this.client
        .from("wardrobe_gaps")
        .select("*")
        .eq("roadmap_id", row.id)
        .order("rank", { ascending: true }),
    ]);
    if (goalsResult.error) throw goalsResult.error;
    if (gapsResult.error) throw gapsResult.error;
    return toRoadmap(
      row,
      goalsResult.data.map(toGoal),
      gapsResult.data.map(toGap),
    );
  }

  private async hydrateOutfit(row: OutfitRow): Promise<Outfit> {
    const [slotsResult, citationsResult] = await Promise.all([
      this.client
        .from("outfit_slots")
        .select("*")
        .eq("outfit_id", row.id)
        .order("sort_order", { ascending: true }),
      this.client
        .from("outfit_rule_citations")
        .select("*")
        .eq("outfit_id", row.id),
    ]);
    if (slotsResult.error) throw slotsResult.error;
    if (citationsResult.error) throw citationsResult.error;
    return toOutfit(
      row,
      slotsResult.data.map(toSlot),
      citationsResult.data.map(toCitation),
    );
  }
}
