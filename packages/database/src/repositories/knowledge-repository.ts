import {
  asId,
  type KnowledgeCommercialIntent,
  type KnowledgeDisplayType,
  type KnowledgeEducationTopic,
  type KnowledgeObject,
  type KnowledgeObjectConcept,
  type KnowledgeObjectId,
  type KnowledgeObjectRelation,
  type KnowledgeRelationKind,
  type MetadataConceptId,
  type RetailerId,
  type RetailerKnowledgeOverride,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type KnowledgeObjectRow =
  Database["public"]["Tables"]["knowledge_objects"]["Row"];
type KnowledgeObjectConceptRow =
  Database["public"]["Tables"]["knowledge_object_concepts"]["Row"];
type KnowledgeObjectRelationRow =
  Database["public"]["Tables"]["knowledge_object_relations"]["Row"];
type RetailerKnowledgeOverrideRow =
  Database["public"]["Tables"]["retailer_knowledge_overrides"]["Row"];

function toKnowledgeObject(row: KnowledgeObjectRow): KnowledgeObject {
  return {
    id: asId<"KnowledgeObjectId">(row.id),
    retailerId:
      row.retailer_id === null ? null : asId<"RetailerId">(row.retailer_id),
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    ...(row.body === null ? {} : { body: row.body }),
    ...(row.image_url === null ? {} : { imageUrl: row.image_url }),
    displayTypes: row.display_types,
    commercialIntent: row.commercial_intent,
    educationTopic: row.education_topic,
    priority: row.priority,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toKnowledgeObjectConcept(
  row: KnowledgeObjectConceptRow,
): KnowledgeObjectConcept {
  return {
    id: asId<"KnowledgeObjectConceptId">(row.id),
    knowledgeObjectId: asId<"KnowledgeObjectId">(row.knowledge_object_id),
    conceptId: asId<"MetadataConceptId">(row.concept_id),
    matchStrength: row.match_strength,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toKnowledgeObjectRelation(
  row: KnowledgeObjectRelationRow,
): KnowledgeObjectRelation {
  return {
    id: asId<"KnowledgeObjectRelationId">(row.id),
    retailerId:
      row.retailer_id === null ? null : asId<"RetailerId">(row.retailer_id),
    sourceKnowledgeObjectId: asId<"KnowledgeObjectId">(
      row.source_knowledge_object_id,
    ),
    targetKnowledgeObjectId: asId<"KnowledgeObjectId">(
      row.target_knowledge_object_id,
    ),
    kind: row.kind,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toKnowledgeOverride(
  row: RetailerKnowledgeOverrideRow,
): RetailerKnowledgeOverride {
  return {
    id: asId<"RetailerKnowledgeOverrideId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    knowledgeObjectId: asId<"KnowledgeObjectId">(row.knowledge_object_id),
    ...(row.title_override === null
      ? {}
      : { titleOverride: row.title_override }),
    ...(row.summary_override === null
      ? {}
      : { summaryOverride: row.summary_override }),
    ...(row.image_url_override === null
      ? {}
      : { imageUrlOverride: row.image_url_override }),
    isHidden: row.is_hidden,
    isPinned: row.is_pinned,
    ...(row.priority_override === null
      ? {}
      : { priorityOverride: row.priority_override }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateKnowledgeObjectParams {
  retailerId: RetailerId | null;
  title: string;
  slug: string;
  summary: string;
  body?: string;
  imageUrl?: string;
  displayTypes: readonly KnowledgeDisplayType[];
  commercialIntent: KnowledgeCommercialIntent;
  educationTopic: KnowledgeEducationTopic;
  priority?: number;
  active?: boolean;
}

export interface CreateKnowledgeObjectConceptParams {
  knowledgeObjectId: KnowledgeObjectId;
  conceptId: MetadataConceptId;
  matchStrength?: number;
}

export interface CreateKnowledgeObjectRelationParams {
  retailerId: RetailerId | null;
  sourceKnowledgeObjectId: KnowledgeObjectId;
  targetKnowledgeObjectId: KnowledgeObjectId;
  kind: KnowledgeRelationKind;
}

export interface UpsertRetailerKnowledgeOverrideParams {
  retailerId: RetailerId;
  knowledgeObjectId: KnowledgeObjectId;
  titleOverride?: string;
  summaryOverride?: string;
  imageUrlOverride?: string;
  isHidden?: boolean;
  isPinned?: boolean;
  priorityOverride?: number;
}

/**
 * Typed persistence for PAON canonical knowledge plus tenant-local overrides.
 * Every tenant read includes an explicit tenant/canonical filter in addition
 * to RLS so service-role callers cannot accidentally widen scope.
 */
export class KnowledgeRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findKnowledgeObjectById(
    retailerId: RetailerId,
    knowledgeObjectId: KnowledgeObjectId,
  ): Promise<KnowledgeObject | null> {
    const { data, error } = await this.client
      .from("knowledge_objects")
      .select("*")
      .eq("id", knowledgeObjectId)
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data === null ? null : toKnowledgeObject(data);
  }

  async findVisibleKnowledgeObjects(
    retailerId: RetailerId,
    educationTopic?: KnowledgeEducationTopic,
  ): Promise<KnowledgeObject[]> {
    let query = this.client
      .from("knowledge_objects")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null);

    if (educationTopic !== undefined) {
      query = query.eq("education_topic", educationTopic);
    }

    const { data, error } = await query.order("priority", { ascending: false });
    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObject);
  }

  async findCanonicalKnowledgeObjects(
    educationTopic?: KnowledgeEducationTopic,
  ): Promise<KnowledgeObject[]> {
    let query = this.client
      .from("knowledge_objects")
      .select("*")
      .is("retailer_id", null)
      .is("deleted_at", null);

    if (educationTopic !== undefined) {
      query = query.eq("education_topic", educationTopic);
    }

    const { data, error } = await query.order("priority", { ascending: false });
    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObject);
  }

  async createKnowledgeObject(
    params: CreateKnowledgeObjectParams,
  ): Promise<KnowledgeObject> {
    const { data, error } = await this.client
      .from("knowledge_objects")
      .insert({
        retailer_id: params.retailerId,
        title: params.title,
        slug: params.slug,
        summary: params.summary,
        body: params.body ?? null,
        image_url: params.imageUrl ?? null,
        display_types: [...params.displayTypes],
        commercial_intent: params.commercialIntent,
        education_topic: params.educationTopic,
        priority: params.priority ?? 0,
        active: params.active ?? true,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toKnowledgeObject(data);
  }

  async findConceptLinksForObject(
    retailerId: RetailerId,
    knowledgeObjectId: KnowledgeObjectId,
  ): Promise<KnowledgeObjectConcept[]> {
    const object = await this.findKnowledgeObjectById(
      retailerId,
      knowledgeObjectId,
    );
    if (object === null) {
      return [];
    }

    const { data, error } = await this.client
      .from("knowledge_object_concepts")
      .select("*")
      .eq("knowledge_object_id", knowledgeObjectId)
      .is("deleted_at", null)
      .order("match_strength", { ascending: false });

    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObjectConcept);
  }

  async createKnowledgeObjectConcept(
    params: CreateKnowledgeObjectConceptParams,
  ): Promise<KnowledgeObjectConcept> {
    const { data, error } = await this.client
      .from("knowledge_object_concepts")
      .insert({
        knowledge_object_id: params.knowledgeObjectId,
        concept_id: params.conceptId,
        match_strength: params.matchStrength ?? 1,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toKnowledgeObjectConcept(data);
  }

  async findVisibleRelations(
    retailerId: RetailerId,
  ): Promise<KnowledgeObjectRelation[]> {
    const { data, error } = await this.client
      .from("knowledge_object_relations")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObjectRelation);
  }

  async createKnowledgeObjectRelation(
    params: CreateKnowledgeObjectRelationParams,
  ): Promise<KnowledgeObjectRelation> {
    const { data, error } = await this.client
      .from("knowledge_object_relations")
      .insert({
        retailer_id: params.retailerId,
        source_knowledge_object_id: params.sourceKnowledgeObjectId,
        target_knowledge_object_id: params.targetKnowledgeObjectId,
        kind: params.kind,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toKnowledgeObjectRelation(data);
  }

  async findKnowledgeOverride(
    retailerId: RetailerId,
    knowledgeObjectId: KnowledgeObjectId,
  ): Promise<RetailerKnowledgeOverride | null> {
    const { data, error } = await this.client
      .from("retailer_knowledge_overrides")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("knowledge_object_id", knowledgeObjectId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data === null ? null : toKnowledgeOverride(data);
  }

  async findKnowledgeOverrides(
    retailerId: RetailerId,
  ): Promise<RetailerKnowledgeOverride[]> {
    const { data, error } = await this.client
      .from("retailer_knowledge_overrides")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
    return data.map(toKnowledgeOverride);
  }

  async upsertKnowledgeOverride(
    params: UpsertRetailerKnowledgeOverrideParams,
  ): Promise<RetailerKnowledgeOverride> {
    const { data, error } = await this.client
      .from("retailer_knowledge_overrides")
      .upsert(
        {
          retailer_id: params.retailerId,
          knowledge_object_id: params.knowledgeObjectId,
          title_override: params.titleOverride ?? null,
          summary_override: params.summaryOverride ?? null,
          image_url_override: params.imageUrlOverride ?? null,
          is_hidden: params.isHidden ?? false,
          is_pinned: params.isPinned ?? false,
          priority_override: params.priorityOverride ?? null,
        },
        { onConflict: "retailer_id,knowledge_object_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toKnowledgeOverride(data);
  }
}
