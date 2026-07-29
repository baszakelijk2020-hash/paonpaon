/**
 * MorningRoutine selection projections (PHASE 4.4 / MR-001, MR-002).
 */

import {
  asId,
  type ConsentStatus,
  type GarmentCategoryCode,
  type MorningRoutineAction,
  type MorningRoutineExplanationFactor,
  type MorningRoutineInputProvenance,
  type MorningRoutineInputStatus,
  type MorningRoutineItemSource,
  type MorningRoutineLocationKind,
  type MorningRoutineRecommendation,
  type MorningRoutineRecommendationId,
  type MorningRoutineReviewStatus,
  type MorningRoutineSelection,
  type MorningRoutineSelectionId,
  type PersistMorningRoutineSelectionInput,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type SelectionRow =
  Database["public"]["Tables"]["morning_routine_selections"]["Row"];
type RecommendationRow =
  Database["public"]["Tables"]["morning_routine_recommendations"]["Row"];

function asJson(value: unknown): Json {
  return value as Json;
}

function parseStringArray(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseFactors(value: Json): MorningRoutineExplanationFactor[] {
  if (!Array.isArray(value)) return [];
  const factors: MorningRoutineExplanationFactor[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof entry.code === "string" &&
      typeof entry.detail === "string"
    ) {
      factors.push({
        code: entry.code as MorningRoutineExplanationFactor["code"],
        detail: entry.detail,
      });
    }
  }
  return factors;
}

function parseActions(value: Json): MorningRoutineAction[] {
  if (!Array.isArray(value)) return [];
  const actions: MorningRoutineAction[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      typeof entry.kind === "string" &&
      typeof entry.available === "boolean"
    ) {
      actions.push({
        kind: entry.kind as MorningRoutineAction["kind"],
        available: entry.available,
        ...(typeof entry.reason === "string" ? { reason: entry.reason } : {}),
        ...(typeof entry.href === "string" ? { href: entry.href } : {}),
        ...(typeof entry.productId === "string"
          ? { productId: entry.productId }
          : {}),
        ...(typeof entry.productVariantId === "string"
          ? { productVariantId: entry.productVariantId }
          : {}),
        ...(typeof entry.wardrobeItemId === "string"
          ? { wardrobeItemId: entry.wardrobeItemId }
          : {}),
      });
    }
  }
  return actions;
}

function toProvenance(row: SelectionRow): MorningRoutineInputProvenance {
  return {
    personalizationConsent: row.personalization_consent as ConsentStatus,
    locationConsent: row.location_consent as ConsentStatus,
    personalizationStatus:
      row.personalization_status as MorningRoutineInputStatus,
    locationStatus: row.location_status as MorningRoutineInputStatus,
    locationKind: row.location_kind as MorningRoutineLocationKind,
    ...(row.location_label ? { locationLabel: row.location_label } : {}),
    weatherStatus: row.weather_status as MorningRoutineInputStatus,
    ...(row.weather_summary ? { weatherSummary: row.weather_summary } : {}),
    calendarStatus: row.calendar_status as MorningRoutineInputStatus,
    occasionLabels: parseStringArray(row.occasion_labels),
  };
}

function toRecommendation(
  row: RecommendationRow,
): MorningRoutineRecommendation & {
  id: MorningRoutineRecommendationId;
  selectionId: MorningRoutineSelectionId;
} {
  return {
    id: asId<"MorningRoutineRecommendationId">(row.id),
    selectionId: asId<"MorningRoutineSelectionId">(row.selection_id),
    rank: row.rank,
    source: row.source as MorningRoutineItemSource,
    displayName: row.display_name,
    ...(row.category_code
      ? { categoryCode: row.category_code as GarmentCategoryCode }
      : {}),
    score: Number(row.score),
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
    ...(row.product_variant_id
      ? { productVariantId: asId<"ProductVariantId">(row.product_variant_id) }
      : {}),
    ...(row.product_slug ? { productSlug: row.product_slug } : {}),
    ...(row.primary_image_url
      ? { primaryImageUrl: row.primary_image_url }
      : {}),
    explanation: parseStringArray(row.explanation),
    factors: parseFactors(row.factors),
    actions: parseActions(row.actions),
  };
}

export interface PersistedMorningRoutineView {
  selection: MorningRoutineSelection & {
    id: MorningRoutineSelectionId;
    reviewStatus: MorningRoutineReviewStatus;
    createdAt: string;
  };
  recommendations: readonly (MorningRoutineRecommendation & {
    id: MorningRoutineRecommendationId;
    selectionId: MorningRoutineSelectionId;
  })[];
}

export class MorningRoutineRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async persistSelection(
    input: PersistMorningRoutineSelectionInput,
  ): Promise<MorningRoutineSelectionId> {
    const { data, error } = await this.client.rpc(
      "persist_morning_routine_selection",
      {
        p_retailer_id: input.retailerId,
        p_customer_id: input.customerId,
        p_for_date: input.forDate,
        p_summary: input.summary,
        p_provenance: asJson(input.provenance),
        p_recommendations: asJson(input.recommendations),
      },
    );
    if (error) throw error;
    return asId<"MorningRoutineSelectionId">(data);
  }

  async markReview(
    selectionId: MorningRoutineSelectionId | string,
    reviewStatus: Extract<MorningRoutineReviewStatus, "saved" | "reviewed">,
  ): Promise<MorningRoutineSelectionId> {
    const { data, error } = await this.client.rpc(
      "mark_morning_routine_review",
      {
        p_selection_id: selectionId,
        p_review_status: reviewStatus,
      },
    );
    if (error) throw error;
    return asId<"MorningRoutineSelectionId">(data);
  }

  async findLatestForCustomerDay(
    customerId: string,
    forDate: string,
  ): Promise<PersistedMorningRoutineView | null> {
    const { data, error } = await this.client
      .from("morning_routine_selections")
      .select("*")
      .eq("customer_id", customerId)
      .eq("for_date", forDate)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.hydrate(data);
  }

  async findById(
    selectionId: MorningRoutineSelectionId | string,
  ): Promise<PersistedMorningRoutineView | null> {
    const { data, error } = await this.client
      .from("morning_routine_selections")
      .select("*")
      .eq("id", selectionId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return this.hydrate(data);
  }

  async listForRetailer(
    retailerId: RetailerId | string,
    limit = 20,
  ): Promise<PersistedMorningRoutineView[]> {
    const { data, error } = await this.client
      .from("morning_routine_selections")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("for_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return Promise.all(data.map((row) => this.hydrate(row)));
  }

  private async hydrate(
    row: SelectionRow,
  ): Promise<PersistedMorningRoutineView> {
    const { data, error } = await this.client
      .from("morning_routine_recommendations")
      .select("*")
      .eq("selection_id", row.id)
      .order("rank", { ascending: true });
    if (error) throw error;

    const recommendations = data.map(toRecommendation);
    return {
      selection: {
        id: asId<"MorningRoutineSelectionId">(row.id),
        retailerId: asId<"RetailerId">(row.retailer_id),
        customerId: asId<"CustomerId">(row.customer_id),
        forDate: row.for_date,
        summary: row.summary,
        recommendations,
        provenance: toProvenance(row),
        reviewStatus: row.review_status as MorningRoutineReviewStatus,
        createdAt: row.created_at,
      },
      recommendations,
    };
  }
}
