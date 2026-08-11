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

  /**
   * Case-insensitive match on one fact type/value, scoped to this
   * retailer only (PHASE 18.12 / BD-112) — the whole point is finding
   * an *existing* customer of *this* retailer, never a cross-tenant
   * search. Used to surface a citable `existing_customer_link` signal
   * (18.1) rather than a silent, unexplained score bump: the caller
   * gets back the real fact row (which customer, which fact) to cite.
   */
  async findByFactTypeAndValue(
    retailerId: RetailerId,
    factType: CustomerFactType,
    valueLabel: string,
  ): Promise<CustomerFact[]> {
    const { data, error } = await this.client
      .from("customer_facts")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("fact_type", factType)
      .ilike("value_label", `%${valueLabel.trim()}%`)
      .is("deleted_at", null)
      .is("superseded_by_fact_id", null)
      .order("observed_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }

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

  /**
   * A single direct-insert fact, for callers that already have a specific
   * fact_type/value in hand rather than a rectangle selection — e.g. an
   * advisor confirming an AI-proposed capture bundle (PHASE: advisor
   * capture). Same RLS-permitted direct-insert path `customer_facts`
   * already grants sales_associate+, no RPC needed.
   */
  async record(args: {
    readonly retailerId: RetailerId;
    readonly customerId: CustomerId;
    readonly staffId: StaffId;
    readonly factType: CustomerFactType;
    readonly valueLabel: string;
    readonly provenanceClass?: CustomerFactProvenanceClass;
    readonly confidence?: number;
    readonly observedAt?: string;
    readonly evidence?: readonly CustomerFactEvidenceRef[];
  }): Promise<CustomerFact> {
    const { data, error } = await this.client
      .from("customer_facts")
      .insert({
        retailer_id: args.retailerId,
        customer_id: args.customerId,
        fact_type: args.factType,
        provenance_class: args.provenanceClass ?? "advisor_observed",
        value_label: args.valueLabel.trim().slice(0, 500),
        confidence: args.confidence ?? 0.9,
        observed_at: args.observedAt ?? new Date().toISOString(),
        author_staff_id: args.staffId,
        evidence: (args.evidence ?? []) as unknown as Json,
      })
      .select("*")
      .single();
    if (error) throw error;
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

  /**
   * Customer-facing correction path. Authorization and eligibility are
   * enforced inside the database function against auth.uid(), so callers
   * cannot substitute another customer or retailer in a Server Action.
   */
  async correctOwnFact(args: {
    readonly factId: string;
    readonly replacementValueLabel: string;
    readonly replacementValueText?: string;
    readonly reason?: string;
  }): Promise<CustomerFact> {
    const { data, error } = await this.client.rpc("correct_own_customer_fact", {
      p_fact_id: args.factId,
      p_replacement_value_label: args.replacementValueLabel.trim(),
      ...(args.replacementValueText?.trim()
        ? { p_replacement_value_text: args.replacementValueText.trim() }
        : {}),
      ...(args.reason?.trim() ? { p_reason: args.reason.trim() } : {}),
    });
    if (error) throw error;
    return toDomain(data);
  }

  async markCorrected(args: {
    readonly retailerId: RetailerId;
    readonly factId: string;
    readonly staffId: StaffId;
    readonly reason: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const { data: existing, error: loadError } = await this.client
      .from("customer_facts")
      .select("*")
      .eq("retailer_id", args.retailerId)
      .eq("id", args.factId)
      .is("deleted_at", null)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) throw new Error("Fact not found");

    const { error: correctionError } = await this.client
      .from("customer_fact_corrections")
      .insert({
        retailer_id: args.retailerId,
        customer_id: existing.customer_id,
        fact_id: args.factId,
        actor_staff_id: args.staffId,
        reason: args.reason.slice(0, 500),
        previous_snapshot: existing as unknown as Json,
        created_at: now,
      });
    if (correctionError) throw correctionError;

    const { error: updateError } = await this.client
      .from("customer_facts")
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .eq("retailer_id", args.retailerId)
      .eq("id", args.factId);
    if (updateError) throw updateError;
  }
}
