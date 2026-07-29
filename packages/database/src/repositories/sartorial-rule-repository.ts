/**
 * Approved sartorial rule persistence (PHASE 4.2 / ROAD-002 / ADR-060).
 */

import {
  asId,
  isSartorialRuleTenantCompatible,
  sartorialReviewTransitionIssues,
  type CreateSartorialRuleInput,
  type OutfitSlotKind,
  type RetailerId,
  type ReviewSartorialRuleInput,
  type SartorialOwnershipKind,
  type SartorialRelation,
  type SartorialReviewStatus,
  type SartorialRule,
  type SartorialRuleId,
  type SartorialRuleKind,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SartorialRuleRow = Database["public"]["Tables"]["sartorial_rules"]["Row"];

function toRule(row: SartorialRuleRow): SartorialRule {
  return {
    id: asId<"SartorialRuleId">(row.id),
    ownershipKind: row.ownership_kind as SartorialOwnershipKind,
    ...(row.retailer_id
      ? { retailerId: asId<"RetailerId">(row.retailer_id) }
      : {}),
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    ruleKind: row.rule_kind as SartorialRuleKind,
    relation: row.relation as SartorialRelation,
    reviewStatus: row.review_status as SartorialReviewStatus,
    ...(row.subject_slot_kind
      ? { subjectSlotKind: row.subject_slot_kind as OutfitSlotKind }
      : {}),
    ...(row.object_slot_kind
      ? { objectSlotKind: row.object_slot_kind as OutfitSlotKind }
      : {}),
    ...(row.subject_concept_id
      ? {
          subjectConceptId: asId<"MetadataConceptId">(row.subject_concept_id),
        }
      : {}),
    ...(row.object_concept_id
      ? {
          objectConceptId: asId<"MetadataConceptId">(row.object_concept_id),
        }
      : {}),
    ...(row.knowledge_object_id
      ? {
          knowledgeObjectId: asId<"KnowledgeObjectId">(row.knowledge_object_id),
        }
      : {}),
    explanation: row.explanation,
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    ...(row.reviewed_by_staff_id
      ? { reviewedByStaffId: asId<"StaffId">(row.reviewed_by_staff_id) }
      : {}),
    ...(row.reviewed_at ? { reviewedAt: row.reviewed_at } : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SartorialRuleRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: SartorialRuleId): Promise<SartorialRule | null> {
    const { data, error } = await this.client
      .from("sartorial_rules")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toRule(data) : null;
  }

  async listApprovedForRetailer(
    retailerId: RetailerId,
  ): Promise<SartorialRule[]> {
    const { data: canonical, error: canonicalError } = await this.client
      .from("sartorial_rules")
      .select("*")
      .eq("ownership_kind", "canonical")
      .eq("review_status", "accepted")
      .is("deleted_at", null)
      .order("slug", { ascending: true });
    if (canonicalError) throw canonicalError;

    const { data: retailerRules, error: retailerError } = await this.client
      .from("sartorial_rules")
      .select("*")
      .eq("ownership_kind", "retailer")
      .eq("retailer_id", retailerId)
      .eq("review_status", "accepted")
      .is("deleted_at", null)
      .order("slug", { ascending: true });
    if (retailerError) throw retailerError;

    return [...canonical, ...retailerRules].map(toRule);
  }

  async listPendingForRetailer(
    retailerId: RetailerId,
  ): Promise<SartorialRule[]> {
    const { data, error } = await this.client
      .from("sartorial_rules")
      .select("*")
      .eq("ownership_kind", "retailer")
      .eq("retailer_id", retailerId)
      .eq("review_status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toRule);
  }

  async proposeRetailerRule(
    input: CreateSartorialRuleInput,
    createdByStaffId: StaffId,
  ): Promise<SartorialRule> {
    if (input.ownershipKind !== "retailer" || !input.retailerId) {
      throw new Error("Only retailer-owned rules may be proposed here.");
    }
    if (
      !isSartorialRuleTenantCompatible({
        ownershipKind: input.ownershipKind,
        retailerId: input.retailerId,
      })
    ) {
      throw new Error("Sartorial rule tenancy is invalid.");
    }

    const { data, error } = await this.client
      .from("sartorial_rules")
      .insert({
        ownership_kind: "retailer",
        retailer_id: input.retailerId,
        slug: input.slug,
        title: input.title,
        summary: input.summary,
        rule_kind: input.ruleKind,
        relation: input.relation,
        review_status: "pending",
        subject_slot_kind: input.subjectSlotKind ?? null,
        object_slot_kind: input.objectSlotKind ?? null,
        subject_concept_id: input.subjectConceptId ?? null,
        object_concept_id: input.objectConceptId ?? null,
        knowledge_object_id: input.knowledgeObjectId ?? null,
        explanation: input.explanation,
        created_by_staff_id: createdByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toRule(data);
  }

  async review(
    input: ReviewSartorialRuleInput,
    reviewedByStaffId: StaffId,
  ): Promise<SartorialRule> {
    const existing = await this.findById(asId<"SartorialRuleId">(input.ruleId));
    if (!existing) {
      throw new Error("Sartorial rule not found.");
    }
    const issues = sartorialReviewTransitionIssues({
      currentStatus: existing.reviewStatus,
      decision: input.decision,
    });
    if (issues.length > 0) {
      throw new Error(`Invalid sartorial review: ${issues.join(", ")}`);
    }

    const { data, error } = await this.client
      .from("sartorial_rules")
      .update({
        review_status: input.decision,
        reviewed_by_staff_id: reviewedByStaffId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", input.ruleId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return toRule(data);
  }
}
