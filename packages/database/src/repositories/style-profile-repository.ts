/**
 * StyleProfile persistence: declared vs inferred preferences, concept
 * evidence, soft removal, and deterministic recompute persistence (PHASE 3.2).
 */

import {
  asId,
  parseDeclaredPreferences,
  parseInferredPreferences,
  parseStyleProfileConfidence,
  recomputeInferredPreferences,
  type CustomerId,
  type CustomerStyleProfile,
  type MetadataConceptId,
  type RecordStyleEvidenceSchemaInput,
  type RemoveInferredStylePreferenceInput,
  type RetailerId,
  type StylePreferenceEvidence,
  type UpsertDeclaredStylePreferenceSchemaInput,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type StyleProfileRow =
  Database["public"]["Tables"]["customer_style_profiles"]["Row"];
type StyleEvidenceRow =
  Database["public"]["Tables"]["customer_style_preference_evidence"]["Row"];

function toEvidence(row: StyleEvidenceRow): StylePreferenceEvidence {
  const base: StylePreferenceEvidence = {
    id: asId<"StylePreferenceEvidenceId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    conceptId: asId<"MetadataConceptId">(row.concept_id),
    source: row.source as StylePreferenceEvidence["source"],
    polarity: row.polarity as StylePreferenceEvidence["polarity"],
    confidence: Number(row.confidence),
    createdAt: row.created_at,
  };

  return {
    ...base,
    ...(row.source_event_id
      ? { sourceEventId: asId<"BehavioralEventId">(row.source_event_id) }
      : {}),
    ...(row.suppressed_at && row.suppressed_by
      ? {
          suppressedAt: row.suppressed_at,
          suppressedBy: row.suppressed_by as NonNullable<
            StylePreferenceEvidence["suppressedBy"]
          >,
          ...(row.suppression_reason
            ? { suppressionReason: row.suppression_reason }
            : {}),
        }
      : {}),
  };
}

function toProfile(row: StyleProfileRow): CustomerStyleProfile {
  return {
    id: asId<"CustomerStyleProfileId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    explicitPreferences: parseDeclaredPreferences(row.explicit_preferences),
    inferredPreferences: parseInferredPreferences(row.inferred_preferences),
    confidence: parseStyleProfileConfidence(row.confidence),
    ...(row.recomputed_at ? { recomputedAt: row.recomputed_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function inferredToJson(
  inferred: ReturnType<
    typeof recomputeInferredPreferences
  >["inferredPreferences"],
): Json {
  return inferred.map((row) => ({
    conceptId: row.conceptId,
    polarity: row.polarity,
    confidence: row.confidence,
    evidenceIds: [...row.evidenceIds],
    lastEvidenceAt: row.lastEvidenceAt,
    score: row.score,
    factors: row.factors.map((factor) => ({
      code: factor.code,
      delta: factor.delta,
      detail: factor.detail,
    })),
  })) as unknown as Json;
}

function confidenceToJson(
  confidence: ReturnType<typeof recomputeInferredPreferences>["confidence"],
): Json {
  return {
    overall: confidence.overall,
    inferredCount: confidence.inferredCount,
    explicitCount: confidence.explicitCount,
    activeEvidenceCount: confidence.activeEvidenceCount,
  };
}

/** StyleProfile reads/writes for intelligence (ADR-061 / PHASE 3.2). */
export class StyleProfileRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<CustomerStyleProfile | null> {
    const { data, error } = await this.client
      .from("customer_style_profiles")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toProfile(data) : null;
  }

  async ensureProfile(customerId: CustomerId): Promise<CustomerStyleProfile> {
    const { data, error } = await this.client.rpc(
      "ensure_customer_style_profile",
      { p_customer_id: customerId },
    );
    if (error) throw error;
    return toProfile(data);
  }

  async listEvidence(
    customerId: CustomerId,
    options?: { readonly includeSuppressed?: boolean; readonly limit?: number },
  ): Promise<StylePreferenceEvidence[]> {
    let query = this.client
      .from("customer_style_preference_evidence")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(options?.limit ?? 200);

    if (!options?.includeSuppressed) {
      query = query.is("suppressed_at", null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toEvidence);
  }

  async upsertDeclared(
    customerId: CustomerId,
    input: UpsertDeclaredStylePreferenceSchemaInput,
  ): Promise<CustomerStyleProfile> {
    const { data, error } = await this.client.rpc(
      "upsert_declared_style_preference",
      {
        p_customer_id: customerId,
        p_concept_id: input.conceptId,
        p_polarity: input.polarity,
        ...(input.note ? { p_note: input.note } : {}),
      },
    );
    if (error) throw error;
    return toProfile(data);
  }

  async removeInferred(
    customerId: CustomerId,
    input: RemoveInferredStylePreferenceInput,
  ): Promise<CustomerStyleProfile> {
    const { data, error } = await this.client.rpc(
      "remove_inferred_style_preference",
      {
        p_customer_id: customerId,
        p_concept_id: input.conceptId,
        ...(input.reason ? { p_reason: input.reason } : {}),
      },
    );
    if (error) throw error;
    return toProfile(data);
  }

  async recordEvidence(
    customerId: CustomerId,
    input: RecordStyleEvidenceSchemaInput,
  ): Promise<StylePreferenceEvidence> {
    const { data, error } = await this.client.rpc(
      "record_style_preference_evidence",
      {
        p_customer_id: customerId,
        p_concept_id: input.conceptId,
        p_source: input.source,
        p_polarity: input.polarity,
        p_confidence: input.confidence,
        ...(input.sourceEventId
          ? { p_source_event_id: input.sourceEventId }
          : {}),
      },
    );
    if (error) throw error;
    return toEvidence(data);
  }

  /**
   * Load active evidence + explicit preferences, recompute deterministically
   * in domain, and persist inferred jsonb without mutating explicit.
   */
  async recompute(
    retailerId: RetailerId,
    customerId: CustomerId,
    now = new Date().toISOString(),
  ): Promise<CustomerStyleProfile> {
    const profile =
      (await this.findByCustomer(retailerId, customerId)) ??
      (await this.ensureProfile(customerId));
    const evidence = await this.listEvidence(customerId, {
      includeSuppressed: false,
    });
    const result = recomputeInferredPreferences({
      explicitPreferences: profile.explicitPreferences,
      evidence,
      now,
    });

    const { data, error } = await this.client.rpc(
      "persist_style_profile_recompute",
      {
        p_customer_id: customerId,
        p_inferred_preferences: inferredToJson(result.inferredPreferences),
        p_confidence: confidenceToJson(result.confidence),
        p_recomputed_at: now,
      },
    );
    if (error) throw error;
    return toProfile(data);
  }

  async findInferredConceptIds(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<readonly MetadataConceptId[]> {
    const profile = await this.findByCustomer(retailerId, customerId);
    if (!profile) return [];
    return profile.inferredPreferences.map((row) => row.conceptId);
  }
}
