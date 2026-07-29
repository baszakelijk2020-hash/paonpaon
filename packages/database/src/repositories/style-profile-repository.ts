import {
  asId,
  explicitStylePreferenceSchema,
  inferredStylePreferenceSchema,
  interactionStyleEvidenceHints,
  mayCapturePersonalizationForCustomer,
  type CustomerId,
  type ExplicitStylePreference,
  type InferredStylePreference,
  type InteractionEventName,
  type MetadataConceptId,
  type RetailerId,
  type SetExplicitStylePreferenceInput,
  type StylePreferenceEvidence,
  type StyleProfile,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type ProfileRow =
  Database["public"]["Tables"]["customer_style_profiles"]["Row"];
type EvidenceRow =
  Database["public"]["Tables"]["customer_style_preference_evidence"]["Row"];

function parseExplicit(value: Json): readonly ExplicitStylePreference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = explicitStylePreferenceSchema.safeParse(entry);
    if (!parsed.success) return [];
    return [
      {
        conceptId: asId<"MetadataConceptId">(parsed.data.conceptId),
        polarity: parsed.data.polarity,
        declaredAt: parsed.data.declaredAt,
      },
    ];
  });
}

function parseInferred(value: Json): readonly InferredStylePreference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = inferredStylePreferenceSchema.safeParse(entry);
    if (!parsed.success) return [];
    return [
      {
        conceptId: asId<"MetadataConceptId">(parsed.data.conceptId),
        score: parsed.data.score,
        confidence: parsed.data.confidence,
        polarity: parsed.data.polarity,
        evidenceCount: parsed.data.evidenceCount,
        lastEvidenceAt: parsed.data.lastEvidenceAt,
        factors: parsed.data.factors.map((factor) => ({
          code: factor.code,
          delta: factor.delta,
          detail: factor.detail,
          ...(factor.evidenceId
            ? {
                evidenceId: asId<"StylePreferenceEvidenceId">(
                  factor.evidenceId,
                ),
              }
            : {}),
        })),
      },
    ];
  });
}

function toProfile(row: ProfileRow): StyleProfile {
  return {
    id: asId<"StyleProfileId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    explicitPreferences: parseExplicit(row.explicit_preferences),
    inferredPreferences: parseInferred(row.inferred_preferences),
    updatedAt: row.updated_at,
    ...(row.recomputed_at ? { recomputedAt: row.recomputed_at } : {}),
  };
}

function toEvidence(row: EvidenceRow): StylePreferenceEvidence {
  return {
    id: asId<"StylePreferenceEvidenceId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    conceptId: asId<"MetadataConceptId">(row.concept_id),
    source: row.source as StylePreferenceEvidence["source"],
    ...(row.source_event_id
      ? {
          sourceEventId: asId<"BehavioralEventId">(row.source_event_id),
        }
      : {}),
    polarity: row.polarity as StylePreferenceEvidence["polarity"],
    confidence: Number(row.confidence),
    createdAt: row.created_at,
    ...(row.removed_at ? { removedAt: row.removed_at } : {}),
  };
}

/** StyleProfile reads and customer preference controls (CUST-002). */
export class StyleProfileRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<StyleProfile | null> {
    const { data, error } = await this.client
      .from("customer_style_profiles")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .maybeSingle();
    if (error) throw error;
    return data ? toProfile(data) : null;
  }

  async listEvidence(
    retailerId: RetailerId,
    customerId: CustomerId,
    options?: { readonly includeRemoved?: boolean },
  ): Promise<StylePreferenceEvidence[]> {
    let query = this.client
      .from("customer_style_preference_evidence")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (!options?.includeRemoved) {
      query = query.is("removed_at", null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toEvidence);
  }

  async setExplicitPreference(
    customerId: CustomerId,
    input: SetExplicitStylePreferenceInput,
  ): Promise<StyleProfile> {
    const { data, error } = await this.client.rpc(
      "set_explicit_style_preference",
      {
        p_customer_id: customerId,
        p_concept_id: input.conceptId,
        p_polarity: input.polarity,
      },
    );
    if (error) throw error;

    const profile = await this.findProfileById(data as string);
    if (!profile) {
      throw new Error("Style profile missing after explicit preference update");
    }
    return profile;
  }

  async removeEvidence(
    customerId: CustomerId,
    evidenceId: StylePreferenceEvidence["id"],
  ): Promise<StyleProfile> {
    const { data, error } = await this.client.rpc(
      "remove_style_preference_evidence",
      {
        p_evidence_id: evidenceId,
      },
    );
    if (error) throw error;

    const profile = await this.findProfileById(data as string);
    if (!profile) {
      throw new Error("Style profile missing after evidence removal");
    }
    if (profile.customerId !== customerId) {
      throw new Error("Evidence does not belong to this customer");
    }
    return profile;
  }

  async recompute(customerId: CustomerId): Promise<StyleProfile> {
    const { data, error } = await this.client.rpc(
      "recompute_customer_style_profile",
      { p_customer_id: customerId },
    );
    if (error) throw error;

    const profile = await this.findProfileById(data as string);
    if (!profile) {
      throw new Error("Style profile missing after recompute");
    }
    return profile;
  }

  /**
   * Records concept evidence from a consented interaction and recomputes.
   * Resolves accepted product concepts when properties omit concept IDs.
   */
  async recordInteractionEvidence(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly personalizationGranted: boolean;
    readonly eventId: string;
    readonly name: InteractionEventName;
    readonly properties: Readonly<Record<string, unknown>>;
    readonly acceptedConceptIds?: readonly MetadataConceptId[];
  }): Promise<void> {
    if (!args.personalizationGranted) return;

    const hints = interactionStyleEvidenceHints({
      name: args.name,
      properties: args.properties,
      ...(args.acceptedConceptIds
        ? { acceptedConceptIds: args.acceptedConceptIds }
        : {}),
    });

    for (const hint of hints) {
      const { error } = await this.client.rpc(
        "record_style_evidence_from_interaction",
        {
          p_customer_id: args.customerId,
          p_source_event_id: args.eventId,
          p_concept_id: hint.conceptId,
          p_polarity: hint.polarity,
          p_confidence: hint.confidence,
        },
      );
      if (error) throw error;
    }
  }

  private async findProfileById(
    profileId: string,
  ): Promise<StyleProfile | null> {
    const { data, error } = await this.client
      .from("customer_style_profiles")
      .select("*")
      .eq("id", profileId)
      .maybeSingle();
    if (error) throw error;
    return data ? toProfile(data) : null;
  }
}

export { mayCapturePersonalizationForCustomer };
