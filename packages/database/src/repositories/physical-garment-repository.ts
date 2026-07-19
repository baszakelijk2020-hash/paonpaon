import {
  asId,
  type CustomerId,
  type GarmentCategoryCode,
  type PhysicalGarment,
  type PhysicalGarmentId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type GarmentRow = Database["public"]["Tables"]["physical_garments"]["Row"];

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
}
