import {
  asId,
  type KnowledgeCommercialIntent,
  type KnowledgeDiscoveryCandidate,
  type KnowledgeDisplayType,
  type KnowledgeObject,
  type KnowledgeObjectConcept,
  type KnowledgeObjectConceptId,
  type KnowledgeObjectId,
  type KnowledgeObjectRelation,
  type KnowledgeObjectRelationId,
  type KnowledgeTopic,
  type MetadataConceptId,
  type RetailerId,
  type RetailerKnowledgeOverride,
  type RetailerKnowledgeOverrideId,
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
    topic: row.topic,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    ...(row.body === null ? {} : { body: row.body }),
    ...(row.image_url === null ? {} : { imageUrl: row.image_url }),
    displayTypes: row.display_types,
    commercialIntent: row.commercial_intent,
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
    sourceKnowledgeObjectId: asId<"KnowledgeObjectId">(
      row.source_knowledge_object_id,
    ),
    targetKnowledgeObjectId: asId<"KnowledgeObjectId">(
      row.target_knowledge_object_id,
    ),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toOverride(
  row: RetailerKnowledgeOverrideRow,
): RetailerKnowledgeOverride {
  return {
    id: asId<"RetailerKnowledgeOverrideId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    knowledgeObjectId: asId<"KnowledgeObjectId">(row.knowledge_object_id),
    ...(row.display_title === null ? {} : { displayTitle: row.display_title }),
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
  topic: KnowledgeTopic;
  title: string;
  slug: string;
  summary: string;
  body?: string;
  imageUrl?: string;
  displayTypes: readonly KnowledgeDisplayType[];
  commercialIntent: KnowledgeCommercialIntent;
  priority?: number;
  active?: boolean;
}

export interface UpdateKnowledgeObjectParams {
  title: string;
  summary: string;
  body?: string;
  imageUrl?: string;
  displayTypes: readonly KnowledgeDisplayType[];
  commercialIntent: KnowledgeCommercialIntent;
  priority: number;
  active: boolean;
}

export interface CreateKnowledgeObjectConceptParams {
  knowledgeObjectId: KnowledgeObjectId;
  conceptId: MetadataConceptId;
  matchStrength?: number;
}

export interface CreateKnowledgeObjectRelationParams {
  sourceKnowledgeObjectId: KnowledgeObjectId;
  targetKnowledgeObjectId: KnowledgeObjectId;
}

export interface UpsertRetailerKnowledgeOverrideParams {
  retailerId: RetailerId;
  knowledgeObjectId: KnowledgeObjectId;
  displayTitle?: string;
  summaryOverride?: string;
  imageUrlOverride?: string;
  isHidden?: boolean;
  isPinned?: boolean;
  priorityOverride?: number;
}

/**
 * Typed persistence for PAON canonical knowledge plus retailer-owned
 * knowledge, concept joins, relations, and local presentation overrides.
 *
 * Tenant reads always include an explicit canonical/tenant filter in addition
 * to RLS so service-role callers cannot accidentally widen scope.
 */
export class KnowledgeRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(
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

  async findVisible(
    retailerId: RetailerId,
    topic?: KnowledgeTopic,
  ): Promise<KnowledgeObject[]> {
    let query = this.client
      .from("knowledge_objects")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null);

    if (topic !== undefined) {
      query = query.eq("topic", topic);
    }

    const { data, error } = await query
      .order("priority", { ascending: false })
      .order("title", { ascending: true });
    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObject);
  }

  async findCanonical(topic?: KnowledgeTopic): Promise<KnowledgeObject[]> {
    let query = this.client
      .from("knowledge_objects")
      .select("*")
      .is("retailer_id", null)
      .is("deleted_at", null);

    if (topic !== undefined) {
      query = query.eq("topic", topic);
    }

    const { data, error } = await query
      .order("priority", { ascending: false })
      .order("title", { ascending: true });
    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObject);
  }

  async create(params: CreateKnowledgeObjectParams): Promise<KnowledgeObject> {
    const { data, error } = await this.client
      .from("knowledge_objects")
      .insert({
        retailer_id: params.retailerId,
        topic: params.topic,
        title: params.title,
        slug: params.slug,
        summary: params.summary,
        body: params.body ?? null,
        image_url: params.imageUrl ?? null,
        display_types: [...params.displayTypes],
        commercial_intent: params.commercialIntent,
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

  async updateCanonical(
    knowledgeObjectId: KnowledgeObjectId,
    params: UpdateKnowledgeObjectParams,
  ): Promise<KnowledgeObject> {
    const { data, error } = await this.client
      .from("knowledge_objects")
      .update({
        title: params.title,
        summary: params.summary,
        body: params.body ?? null,
        image_url: params.imageUrl ?? null,
        display_types: [...params.displayTypes],
        commercial_intent: params.commercialIntent,
        priority: params.priority,
        active: params.active,
      })
      .eq("id", knowledgeObjectId)
      .is("retailer_id", null)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toKnowledgeObject(data);
  }

  async findConceptsForObject(
    knowledgeObjectId: KnowledgeObjectId,
  ): Promise<KnowledgeObjectConcept[]> {
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

  async createConceptJoin(
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

  async findRelationsForObject(
    knowledgeObjectId: KnowledgeObjectId,
  ): Promise<KnowledgeObjectRelation[]> {
    const { data, error } = await this.client
      .from("knowledge_object_relations")
      .select("*")
      .or(
        `source_knowledge_object_id.eq.${knowledgeObjectId},target_knowledge_object_id.eq.${knowledgeObjectId}`,
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }
    return data.map(toKnowledgeObjectRelation);
  }

  async createRelation(
    params: CreateKnowledgeObjectRelationParams,
  ): Promise<KnowledgeObjectRelation> {
    const { data, error } = await this.client
      .from("knowledge_object_relations")
      .insert({
        source_knowledge_object_id: params.sourceKnowledgeObjectId,
        target_knowledge_object_id: params.targetKnowledgeObjectId,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toKnowledgeObjectRelation(data);
  }

  async findOverride(
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
    return data === null ? null : toOverride(data);
  }

  async upsertOverride(
    params: UpsertRetailerKnowledgeOverrideParams,
  ): Promise<RetailerKnowledgeOverride> {
    const { data, error } = await this.client
      .from("retailer_knowledge_overrides")
      .upsert(
        {
          retailer_id: params.retailerId,
          knowledge_object_id: params.knowledgeObjectId,
          display_title: params.displayTitle ?? null,
          summary_override: params.summaryOverride ?? null,
          image_url_override: params.imageUrlOverride ?? null,
          is_hidden: params.isHidden ?? false,
          is_pinned: params.isPinned ?? false,
          priority_override: params.priorityOverride ?? null,
          deleted_at: null,
        },
        { onConflict: "retailer_id,knowledge_object_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toOverride(data);
  }

  /**
   * Projects discovery candidates for accepted product concepts only.
   * Ranking/explanation stays in `@paon/domain` (`rankKnowledgeDiscovery`).
   */
  async projectDiscoveryCandidates(
    retailerId: RetailerId,
    acceptedProductConceptIds: readonly MetadataConceptId[],
  ): Promise<KnowledgeDiscoveryCandidate[]> {
    if (acceptedProductConceptIds.length === 0) {
      return [];
    }

    const { data: joins, error: joinsError } = await this.client
      .from("knowledge_object_concepts")
      .select("*")
      .in("concept_id", [...acceptedProductConceptIds])
      .is("deleted_at", null);

    if (joinsError) {
      throw joinsError;
    }
    if (joins.length === 0) {
      return [];
    }

    const knowledgeObjectIds = [
      ...new Set(joins.map((row) => row.knowledge_object_id)),
    ];

    const { data: objects, error: objectsError } = await this.client
      .from("knowledge_objects")
      .select("*")
      .in("id", knowledgeObjectIds)
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null);

    if (objectsError) {
      throw objectsError;
    }

    const { data: allJoins, error: allJoinsError } = await this.client
      .from("knowledge_object_concepts")
      .select("*")
      .in("knowledge_object_id", knowledgeObjectIds)
      .is("deleted_at", null);

    if (allJoinsError) {
      throw allJoinsError;
    }

    const { data: overrides, error: overridesError } = await this.client
      .from("retailer_knowledge_overrides")
      .select("*")
      .eq("retailer_id", retailerId)
      .in("knowledge_object_id", knowledgeObjectIds)
      .is("deleted_at", null);

    if (overridesError) {
      throw overridesError;
    }

    const overrideByObjectId = new Map(
      overrides.map((row) => [row.knowledge_object_id, toOverride(row)]),
    );
    const joinsByObjectId = new Map<string, KnowledgeObjectConceptRow[]>();
    for (const join of allJoins) {
      const existing = joinsByObjectId.get(join.knowledge_object_id) ?? [];
      existing.push(join);
      joinsByObjectId.set(join.knowledge_object_id, existing);
    }

    return objects.map((row) => {
      const objectJoins = joinsByObjectId.get(row.id) ?? [];
      return {
        object: toKnowledgeObject(row),
        matchedConcepts: objectJoins.map((join) => ({
          conceptId: asId<"MetadataConceptId">(join.concept_id),
          matchStrength: join.match_strength,
        })),
        override: overrideByObjectId.get(row.id) ?? null,
      };
    });
  }
}

export type {
  KnowledgeObjectId,
  KnowledgeObjectConceptId,
  KnowledgeObjectRelationId,
  RetailerKnowledgeOverrideId,
};
