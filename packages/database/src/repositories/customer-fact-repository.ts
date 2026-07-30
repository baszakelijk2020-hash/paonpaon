/**
 * Provenance-aware customer facts repository (CLI-003 / PHASE 7.3).
 */

import {
  asId,
  type AdvisorRectangleKind,
  type CustomerFact,
  type CustomerFactEvidenceRef,
  type CustomerFactProvenanceClass,
  type CustomerFactSensitivity,
  type CustomerFactType,
  type CustomerFactVisibility,
  type CustomerFactId,
  type BehavioralEventId,
  type CustomerId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type Row = Database["public"]["Tables"]["customer_facts"]["Row"];

function parseEvidence(value: Json): readonly CustomerFactEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  const out: CustomerFactEvidenceRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    out.push({
      ...(typeof row.eventId === "string"
        ? { eventId: asId<"BehavioralEventId">(row.eventId) }
        : {}),
      ...(typeof row.styleEvidenceId === "string"
        ? {
            styleEvidenceId: asId<"StylePreferenceEvidenceId">(
              row.styleEvidenceId,
            ),
          }
        : {}),
      ...(typeof row.productId === "string"
        ? { productId: asId<"ProductId">(row.productId) }
        : {}),
      ...(typeof row.conceptId === "string"
        ? { conceptId: asId<"MetadataConceptId">(row.conceptId) }
        : {}),
      ...(typeof row.note === "string" ? { note: row.note } : {}),
    });
  }
  return out;
}

function toDomain(row: Row): CustomerFact {
  return {
    id: asId<"CustomerFactId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    factType: row.fact_type as CustomerFactType,
    provenanceClass: row.provenance_class as CustomerFactProvenanceClass,
    valueLabel: row.value_label,
    ...(row.value_concept_id
      ? { valueConceptId: asId<"MetadataConceptId">(row.value_concept_id) }
      : {}),
    ...(row.value_text ? { valueText: row.value_text } : {}),
    confidence: Number(row.confidence),
    sensitivity: row.sensitivity as CustomerFactSensitivity,
    visibility: row.visibility as CustomerFactVisibility,
    observedAt: row.observed_at,
    ...(row.valid_from ? { validFrom: row.valid_from } : {}),
    ...(row.valid_until ? { validUntil: row.valid_until } : {}),
    ...(row.review_by ? { reviewBy: row.review_by } : {}),
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    ...(row.author_staff_id
      ? { authorStaffId: asId<"StaffId">(row.author_staff_id) }
      : {}),
    ...(row.author_customer_id
      ? { authorCustomerId: asId<"CustomerId">(row.author_customer_id) }
      : {}),
    evidence: parseEvidence(row.evidence),
    ...(row.superseded_by_fact_id
      ? {
          supersededByFactId: asId<"CustomerFactId">(row.superseded_by_fact_id),
        }
      : {}),
    ...(row.correction_of_fact_id
      ? {
          correctionOfFactId: asId<"CustomerFactId">(row.correction_of_fact_id),
        }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomerFactRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listForCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
    limit = 40,
  ): Promise<CustomerFact[]> {
    const { data, error } = await this.client
      .from("customer_facts")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .is("superseded_by_fact_id", null)
      .order("observed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  async recordCorrection(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly factId: CustomerFactId;
    readonly staffId?: StaffId;
    readonly customerActorId?: CustomerId;
    readonly reason: string;
    readonly excludedEventIds?: readonly BehavioralEventId[];
  }): Promise<CustomerFact> {
    const { data, error } = await this.client.rpc(
      "record_customer_fact_correction",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_fact_id: args.factId,
        p_reason: args.reason,
        ...(args.staffId ? { p_actor_staff_id: args.staffId } : {}),
        ...(args.customerActorId
          ? { p_actor_customer_id: args.customerActorId }
          : {}),
        p_excluded_event_ids: [...(args.excludedEventIds ?? [])],
      },
    );
    if (error) throw error;
    if (!data) throw new Error("Correction did not return fact snapshot");
    return toDomain(data);
  }

  async recordAdvisorRectangles(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly staffId: StaffId;
    readonly observedAt: string;
    readonly selections: readonly {
      readonly conceptId: string;
      readonly kind: AdvisorRectangleKind;
      readonly label: string;
      readonly polarity: "positive" | "negative";
    }[];
    readonly freeformNote?: string;
  }): Promise<CustomerFact[]> {
    const { data, error } = await this.client.rpc(
      "record_advisor_rectangle_facts",
      {
        p_retailer_id: args.retailerId,
        p_customer_id: args.customerId,
        p_staff_id: args.staffId,
        p_observed_at: args.observedAt,
        p_selections: args.selections as unknown as Json,
        ...(args.freeformNote ? { p_freeform_note: args.freeformNote } : {}),
      },
    );
    if (error) throw error;
    return (data ?? []).map(toDomain);
  }
}
