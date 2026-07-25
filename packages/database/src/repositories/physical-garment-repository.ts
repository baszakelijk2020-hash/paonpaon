import {
  asId,
  type CustomerId,
  type FittingObservation,
  type GarmentCategoryCode,
  type PhysicalGarment,
  type PhysicalGarmentId,
  type WorkClassification,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type GarmentRow = Database["public"]["Tables"]["physical_garments"]["Row"];
type FittingObservationRow =
  Database["public"]["Tables"]["fitting_observations"]["Row"];

function observationToDomain(row: FittingObservationRow): FittingObservation {
  return {
    id: asId<"FittingObservationId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    fittingSessionId: asId<"FittingSessionId">(row.fitting_session_id),
    physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
    classification: row.classification,
    area: row.area,
    observation: row.observation,
    ...(row.recorded_by_staff_id
      ? { recordedByStaffId: asId<"StaffId">(row.recorded_by_staff_id) }
      : {}),
    createdAt: row.created_at,
  };
}

function toDomain(row: GarmentRow): PhysicalGarment {
  return {
    id: asId<"PhysicalGarmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    sourceKind: row.source_kind,
    categoryCode: row.category_code as GarmentCategoryCode,
    garmentType: row.garment_type,
    ...(row.brand ? { brand: row.brand } : {}),
    description: row.description,
    ...(row.identifying_photo_url
      ? { identifyingPhotoUrl: row.identifying_photo_url }
      : {}),
    labelMetadata: row.label_metadata as Record<string, string>,
    intakeCondition: row.intake_condition,
    ...(row.external_reference
      ? { externalReference: row.external_reference }
      : {}),
    ...(row.order_line_id
      ? { orderLineId: asId<"OrderLineId">(row.order_line_id) }
      : {}),
    ...(row.supplier_order_reference
      ? { supplierOrderReference: row.supplier_order_reference }
      : {}),
    identificationState: row.identification_state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export class PhysicalGarmentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: PhysicalGarmentId): Promise<PhysicalGarment | null> {
    const { data, error } = await this.client
      .from("physical_garments")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findByCustomer(customerId: CustomerId): Promise<PhysicalGarment[]> {
    const { data, error } = await this.client
      .from("physical_garments")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findObservationsByGarment(
    garmentId: PhysicalGarmentId,
  ): Promise<FittingObservation[]> {
    const { data, error } = await this.client
      .from("fitting_observations")
      .select("*")
      .eq("physical_garment_id", garmentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(observationToDomain);
  }

  /** Opens a new fitting_session per call — a follow-up fitting is a
   * genuinely new encounter, never conflated with the intake session
   * create_alteration_intake already created. See
   * 20260725000002_add_fitting_observation_rpc.sql for why this exists
   * as its own narrow RPC rather than a direct insert. */
  async addObservation(params: {
    physicalGarmentId: PhysicalGarmentId;
    area: string;
    observation: string;
    classification?: WorkClassification;
  }): Promise<FittingObservation> {
    const { data, error } = await this.client.rpc("add_fitting_observation", {
      p_physical_garment_id: params.physicalGarmentId,
      p_area: params.area,
      p_observation: params.observation,
      p_classification: params.classification ?? "work_now",
    });
    if (error) throw error;

    const { data: row, error: fetchError } = await this.client
      .from("fitting_observations")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchError) throw fetchError;
    return observationToDomain(row);
  }
}
