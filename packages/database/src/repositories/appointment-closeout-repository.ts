/**
 * Post-appointment closeout repository (CLI-006 / PHASE 7.5).
 */

import {
  asId,
  type AppointmentCloseout,
  type AppointmentCloseoutOutcome,
  type AppointmentCloseoutSelection,
  type AppointmentId,
  type CustomerFact,
  type CustomerFactEvidenceRef,
  type CustomerFactProvenanceClass,
  type CustomerFactSensitivity,
  type CustomerFactType,
  type CustomerFactVisibility,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type CloseoutRow = Database["public"]["Tables"]["appointment_closeouts"]["Row"];
type FactRow = Database["public"]["Tables"]["customer_facts"]["Row"];

function parseEvidence(value: Json): readonly CustomerFactEvidenceRef[] {
  if (!Array.isArray(value)) return [];
  const out: CustomerFactEvidenceRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    out.push({
      ...(typeof row.note === "string" ? { note: row.note } : {}),
    });
  }
  return out;
}

function factToDomain(row: FactRow): CustomerFact {
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
    ...(row.author_staff_id
      ? { authorStaffId: asId<"StaffId">(row.author_staff_id) }
      : {}),
    evidence: parseEvidence(row.evidence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseSelections(value: Json): readonly AppointmentCloseoutSelection[] {
  if (!Array.isArray(value)) return [];
  const out: AppointmentCloseoutSelection[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    if (
      typeof row.conceptId !== "string" ||
      typeof row.kind !== "string" ||
      typeof row.label !== "string"
    ) {
      continue;
    }
    out.push({
      conceptId: asId<"MetadataConceptId">(row.conceptId),
      kind: row.kind as AppointmentCloseoutSelection["kind"],
      label: row.label,
      polarity: row.polarity === "negative" ? "negative" : "positive",
    });
  }
  return out;
}

function toDomain(row: CloseoutRow): AppointmentCloseout {
  return {
    id: asId<"AppointmentCloseoutId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    appointmentId: asId<"AppointmentId">(row.appointment_id),
    customerId: asId<"CustomerId">(row.customer_id),
    authorStaffId: asId<"StaffId">(row.author_staff_id),
    outcome: row.outcome as AppointmentCloseoutOutcome,
    selections: parseSelections(row.rectangle_selections),
    ...(row.follow_up_notes ? { followUpNotes: row.follow_up_notes } : {}),
    ...(row.follow_up_at ? { followUpAt: row.follow_up_at } : {}),
    createdAt: row.created_at,
  };
}

export class AppointmentCloseoutRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByAppointment(
    appointmentId: AppointmentId,
  ): Promise<AppointmentCloseout | null> {
    const { data, error } = await this.client
      .from("appointment_closeouts")
      .select("*")
      .eq("appointment_id", appointmentId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async recordCloseout(args: {
    readonly retailerId: RetailerId;
    readonly appointmentId: AppointmentId;
    readonly staffId: StaffId;
    readonly outcome: AppointmentCloseoutOutcome;
    readonly selections: readonly {
      readonly conceptId: string;
      readonly kind: string;
      readonly label: string;
      readonly polarity: "positive" | "negative";
    }[];
    readonly followUpNotes?: string;
    readonly followUpAt?: string;
  }): Promise<CustomerFact[]> {
    const { data, error } = await this.client.rpc("record_appointment_closeout", {
      p_retailer_id: args.retailerId,
      p_appointment_id: args.appointmentId,
      p_staff_id: args.staffId,
      p_outcome: args.outcome,
      p_selections: args.selections as unknown as Json,
      ...(args.followUpNotes ? { p_follow_up_notes: args.followUpNotes } : {}),
      ...(args.followUpAt ? { p_follow_up_at: args.followUpAt } : {}),
    });
    if (error) throw error;
    return (data ?? []).map((row) => factToDomain(row as FactRow));
  }
}
