import {
  asId,
  metadataEvidenceSchema,
  type EntityMetadataAssignment,
  type EntityMetadataAssignmentId,
  type MetadataAssignmentReview,
  type MetadataConcept,
  type MetadataConceptEdge,
  type MetadataConceptId,
  type MetadataEdgeKind,
  type MetadataEvidence,
  type MetadataReviewDecision,
  type MetadataReviewStatus,
  type MetadataSource,
  type MetadataTarget,
  type ProductId,
  type ProductVariantId,
  type RetailerConceptOverride,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type MetadataConceptRow =
  Database["public"]["Tables"]["metadata_concepts"]["Row"];
type MetadataConceptEdgeRow =
  Database["public"]["Tables"]["metadata_concept_edges"]["Row"];
type EntityMetadataAssignmentRow =
  Database["public"]["Tables"]["entity_metadata_assignments"]["Row"];
type MetadataAssignmentReviewRow =
  Database["public"]["Tables"]["metadata_assignment_reviews"]["Row"];
type RetailerConceptOverrideRow =
  Database["public"]["Tables"]["retailer_concept_overrides"]["Row"];

function toAttributes(value: Json): Readonly<Record<string, unknown>> {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Metadata concept attributes must be a JSON object");
  }
  return value;
}

function toJsonAttributes(value: Readonly<Record<string, unknown>>): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function toEvidence(value: Json | null): MetadataEvidence | undefined {
  if (value === null) {
    return undefined;
  }
  const evidence = metadataEvidenceSchema.parse(value);
  return {
    summary: evidence.summary,
    ...(evidence.sourceReference === undefined
      ? {}
      : { sourceReference: evidence.sourceReference }),
  };
}

function toConcept(row: MetadataConceptRow): MetadataConcept {
  return {
    id: asId<"MetadataConceptId">(row.id),
    retailerId:
      row.retailer_id === null ? null : asId<"RetailerId">(row.retailer_id),
    kind: row.kind,
    slug: row.slug,
    canonicalName: row.canonical_name,
    attributes: toAttributes(row.attributes),
    ...(row.image_url === null ? {} : { imageUrl: row.image_url }),
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toEdge(row: MetadataConceptEdgeRow): MetadataConceptEdge {
  return {
    id: asId<"MetadataConceptEdgeId">(row.id),
    retailerId:
      row.retailer_id === null ? null : asId<"RetailerId">(row.retailer_id),
    sourceConceptId: asId<"MetadataConceptId">(row.source_concept_id),
    targetConceptId: asId<"MetadataConceptId">(row.target_concept_id),
    kind: row.kind,
    weight: row.weight,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toTarget(
  row: Pick<EntityMetadataAssignmentRow, "target_id" | "target_type">,
): MetadataTarget {
  switch (row.target_type) {
    case "product":
      return {
        targetType: "product",
        targetId: asId<"ProductId">(row.target_id),
      };
    case "product_variant":
      return {
        targetType: "product_variant",
        targetId: asId<"ProductVariantId">(row.target_id),
      };
    case "wardrobe_item":
      return {
        targetType: "wardrobe_item",
        targetId: asId<"WardrobeItemId">(row.target_id),
      };
  }
}

function toAssignment(
  row: EntityMetadataAssignmentRow,
): EntityMetadataAssignment {
  const evidence = toEvidence(row.evidence);
  return {
    id: asId<"EntityMetadataAssignmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    target: toTarget(row),
    conceptId: asId<"MetadataConceptId">(row.concept_id),
    source: row.source,
    ...(row.confidence === null ? {} : { confidence: row.confidence }),
    reviewStatus: row.review_status,
    ...(row.supplier_value === null
      ? {}
      : { supplierValue: row.supplier_value }),
    ...(evidence === undefined ? {} : { evidence }),
    ...(row.reviewed_by_staff_id === null
      ? {}
      : {
          reviewedByStaffId: asId<"StaffId">(row.reviewed_by_staff_id),
        }),
    ...(row.reviewed_at === null ? {} : { reviewedAt: row.reviewed_at }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function toReview(row: MetadataAssignmentReviewRow): MetadataAssignmentReview {
  if (row.review_status === "pending") {
    throw new Error("Persisted metadata reviews cannot be pending");
  }
  const evidence = toEvidence(row.evidence);
  return {
    id: asId<"MetadataAssignmentReviewId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    assignmentId: asId<"EntityMetadataAssignmentId">(row.assignment_id),
    previousStatus: row.previous_status,
    reviewStatus: row.review_status,
    reviewedByStaffId: asId<"StaffId">(row.reviewed_by_staff_id),
    source: row.source,
    ...(row.confidence === null ? {} : { confidence: row.confidence }),
    ...(row.supplier_value === null
      ? {}
      : { supplierValue: row.supplier_value }),
    ...(evidence === undefined ? {} : { evidence }),
    createdAt: row.created_at,
  };
}

function toOverride(row: RetailerConceptOverrideRow): RetailerConceptOverride {
  return {
    id: asId<"RetailerConceptOverrideId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    conceptId: asId<"MetadataConceptId">(row.concept_id),
    ...(row.display_name === null ? {} : { displayName: row.display_name }),
    ...(row.summary_override === null
      ? {}
      : { summaryOverride: row.summary_override }),
    ...(row.image_url_override === null
      ? {}
      : { imageUrlOverride: row.image_url_override }),
    isHidden: row.is_hidden,
    ...(row.priority_override === null
      ? {}
      : { priorityOverride: row.priority_override }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateMetadataConceptParams {
  retailerId: RetailerId | null;
  kind: MetadataConcept["kind"];
  slug: string;
  canonicalName: string;
  attributes?: Readonly<Record<string, unknown>>;
  imageUrl?: string;
  active?: boolean;
}

export interface CreateMetadataConceptEdgeParams {
  retailerId: RetailerId | null;
  sourceConceptId: MetadataConceptId;
  targetConceptId: MetadataConceptId;
  kind: MetadataEdgeKind;
  weight?: number;
}

export interface CreateEntityMetadataAssignmentParams {
  retailerId: RetailerId;
  target: MetadataTarget;
  conceptId: MetadataConceptId;
  source: MetadataSource;
  confidence?: number;
  supplierValue?: string;
  evidence?: MetadataEvidence;
}

export interface UpdateMetadataConceptParams {
  canonicalName: string;
  attributes?: Readonly<Record<string, unknown>>;
  imageUrl?: string;
  active: boolean;
}

export interface UpsertRetailerConceptOverrideParams {
  retailerId: RetailerId;
  conceptId: MetadataConceptId;
  displayName?: string;
  summaryOverride?: string;
  imageUrlOverride?: string;
  isHidden?: boolean;
  priorityOverride?: number;
}

/**
 * Typed persistence for PAON canonical concepts plus tenant-local concepts,
 * edges, assignments, and retailer presentation overrides.
 *
 * Every tenant read includes an explicit tenant/canonical filter in addition
 * to RLS. That keeps service-role callers from accidentally widening scope.
 */
export class MetadataRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findConceptById(
    retailerId: RetailerId,
    conceptId: MetadataConceptId,
  ): Promise<MetadataConcept | null> {
    const { data, error } = await this.client
      .from("metadata_concepts")
      .select("*")
      .eq("id", conceptId)
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data === null ? null : toConcept(data);
  }

  async findVisibleConcepts(
    retailerId: RetailerId,
    kind?: MetadataConcept["kind"],
  ): Promise<MetadataConcept[]> {
    let query = this.client
      .from("metadata_concepts")
      .select("*")
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null);

    if (kind !== undefined) {
      query = query.eq("kind", kind);
    }

    const { data, error } = await query.order("canonical_name", {
      ascending: true,
    });
    if (error) {
      throw error;
    }
    return data.map(toConcept);
  }

  async findCanonicalConcepts(
    kind?: MetadataConcept["kind"],
  ): Promise<MetadataConcept[]> {
    let query = this.client
      .from("metadata_concepts")
      .select("*")
      .is("retailer_id", null)
      .is("deleted_at", null);

    if (kind !== undefined) {
      query = query.eq("kind", kind);
    }

    const { data, error } = await query.order("canonical_name", {
      ascending: true,
    });
    if (error) {
      throw error;
    }
    return data.map(toConcept);
  }

  async createConcept(
    params: CreateMetadataConceptParams,
  ): Promise<MetadataConcept> {
    const { data, error } = await this.client
      .from("metadata_concepts")
      .insert({
        retailer_id: params.retailerId,
        kind: params.kind,
        slug: params.slug,
        canonical_name: params.canonicalName,
        attributes: toJsonAttributes(params.attributes ?? {}),
        image_url: params.imageUrl ?? null,
        active: params.active ?? true,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toConcept(data);
  }

  async updateCanonicalConcept(
    conceptId: MetadataConceptId,
    params: UpdateMetadataConceptParams,
  ): Promise<MetadataConcept> {
    const { data, error } = await this.client
      .from("metadata_concepts")
      .update({
        canonical_name: params.canonicalName,
        attributes: toJsonAttributes(params.attributes ?? {}),
        image_url: params.imageUrl ?? null,
        active: params.active,
      })
      .eq("id", conceptId)
      .is("retailer_id", null)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toConcept(data);
  }

  async findVisibleEdges(
    retailerId: RetailerId,
    sourceConceptId: MetadataConceptId,
  ): Promise<MetadataConceptEdge[]> {
    const { data, error } = await this.client
      .from("metadata_concept_edges")
      .select("*")
      .eq("source_concept_id", sourceConceptId)
      .or(`retailer_id.is.null,retailer_id.eq.${retailerId}`)
      .is("deleted_at", null)
      .order("weight", { ascending: false });

    if (error) {
      throw error;
    }
    return data.map(toEdge);
  }

  async createEdge(
    params: CreateMetadataConceptEdgeParams,
  ): Promise<MetadataConceptEdge> {
    const { data, error } = await this.client
      .from("metadata_concept_edges")
      .insert({
        retailer_id: params.retailerId,
        source_concept_id: params.sourceConceptId,
        target_concept_id: params.targetConceptId,
        kind: params.kind,
        weight: params.weight ?? 1,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toEdge(data);
  }

  /**
   * "Complete the look" (PHASE 17.4 / ADV-104): real, currently active
   * products carrying at least one of the given concepts, reviewed and
   * accepted only — never a pending/rejected assignment, and never a
   * fabricated list when no product carries any of them.
   */
  async findProductIdsByConcepts(
    retailerId: RetailerId,
    conceptIds: readonly MetadataConceptId[],
    limit = 6,
  ): Promise<readonly ProductId[]> {
    if (conceptIds.length === 0) return [];
    const { data, error } = await this.client
      .from("entity_metadata_assignments")
      .select("target_id")
      .eq("retailer_id", retailerId)
      .eq("target_type", "product")
      .eq("review_status", "accepted")
      .in("concept_id", conceptIds)
      .is("deleted_at", null);
    if (error) throw error;
    const uniqueIds = [...new Set(data.map((row) => row.target_id))];
    return uniqueIds.slice(0, limit).map((id) => asId<"ProductId">(id));
  }

  async findAssignmentsForTarget(
    retailerId: RetailerId,
    target: MetadataTarget,
  ): Promise<EntityMetadataAssignment[]> {
    const { data, error } = await this.client
      .from("entity_metadata_assignments")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("target_type", target.targetType)
      .eq("target_id", target.targetId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }
    return data.map(toAssignment);
  }

  /**
   * Resolve the reviewed, currently visible concepts that may become
   * customer intelligence for a product interaction. Variant assignments are
   * folded onto their parent product, while pending/rejected or inactive
   * concepts never leave the repository boundary.
   */
  async findAcceptedConceptIdsForProduct(
    retailerId: RetailerId,
    productId: ProductId,
    productVariantId?: ProductVariantId,
  ): Promise<readonly MetadataConceptId[]> {
    const targets: MetadataTarget[] = [
      { targetType: "product", targetId: productId },
      ...(productVariantId
        ? ([
            {
              targetType: "product_variant",
              targetId: productVariantId,
            },
          ] as const)
        : []),
    ];
    const assignments = (
      await Promise.all(
        targets.map((target) =>
          this.findAssignmentsForTarget(retailerId, target),
        ),
      )
    ).flat();
    const acceptedIds = [
      ...new Set(
        assignments
          .filter((assignment) => assignment.reviewStatus === "accepted")
          .map((assignment) => assignment.conceptId),
      ),
    ];
    const concepts = await Promise.all(
      acceptedIds.map((conceptId) =>
        this.findConceptById(retailerId, conceptId),
      ),
    );
    return concepts
      .filter((concept): concept is MetadataConcept => Boolean(concept?.active))
      .map((concept) => concept.id)
      .sort();
  }

  async findAssignmentsForReview(
    retailerId: RetailerId,
    reviewStatus?: MetadataReviewStatus,
  ): Promise<EntityMetadataAssignment[]> {
    let query = this.client
      .from("entity_metadata_assignments")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null);

    if (reviewStatus !== undefined) {
      query = query.eq("review_status", reviewStatus);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) {
      throw error;
    }
    return data.map(toAssignment);
  }

  async findAssignmentById(
    retailerId: RetailerId,
    assignmentId: EntityMetadataAssignmentId,
  ): Promise<EntityMetadataAssignment | null> {
    const { data, error } = await this.client
      .from("entity_metadata_assignments")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("id", assignmentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data === null ? null : toAssignment(data);
  }

  async createAssignment(
    params: CreateEntityMetadataAssignmentParams,
  ): Promise<EntityMetadataAssignment> {
    const { data, error } = await this.client
      .from("entity_metadata_assignments")
      .insert({
        retailer_id: params.retailerId,
        target_type: params.target.targetType,
        target_id: params.target.targetId,
        concept_id: params.conceptId,
        source: params.source,
        confidence: params.confidence ?? null,
        review_status: "pending",
        supplier_value: params.supplierValue ?? null,
        evidence:
          params.evidence === undefined
            ? null
            : {
                summary: params.evidence.summary,
                ...(params.evidence.sourceReference === undefined
                  ? {}
                  : { sourceReference: params.evidence.sourceReference }),
              },
        reviewed_by_staff_id: null,
        reviewed_at: null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toAssignment(data);
  }

  async reviewAssignment(
    retailerId: RetailerId,
    assignmentId: EntityMetadataAssignmentId,
    decision: MetadataReviewDecision,
  ): Promise<EntityMetadataAssignment> {
    const { error } = await this.client.rpc("review_metadata_assignment", {
      p_assignment_id: assignmentId,
      p_review_status: decision,
    });
    if (error) {
      throw error;
    }

    const assignment = await this.findAssignmentById(retailerId, assignmentId);
    if (assignment === null) {
      throw new Error("Reviewed metadata assignment could not be reloaded");
    }
    return assignment;
  }

  async findAssignmentReviews(
    retailerId: RetailerId,
    assignmentId: EntityMetadataAssignmentId,
  ): Promise<MetadataAssignmentReview[]> {
    const { data, error } = await this.client
      .from("metadata_assignment_reviews")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }
    return data.map(toReview);
  }

  async findOverrides(
    retailerId: RetailerId,
  ): Promise<RetailerConceptOverride[]> {
    const { data, error } = await this.client
      .from("retailer_concept_overrides")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }
    return data.map(toOverride);
  }

  async upsertOverride(
    params: UpsertRetailerConceptOverrideParams,
  ): Promise<RetailerConceptOverride> {
    const { data, error } = await this.client
      .from("retailer_concept_overrides")
      .upsert(
        {
          retailer_id: params.retailerId,
          concept_id: params.conceptId,
          display_name: params.displayName ?? null,
          summary_override: params.summaryOverride ?? null,
          image_url_override: params.imageUrlOverride ?? null,
          is_hidden: params.isHidden ?? false,
          priority_override: params.priorityOverride ?? null,
          deleted_at: null,
        },
        { onConflict: "retailer_id,concept_id" },
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toOverride(data);
  }
}
