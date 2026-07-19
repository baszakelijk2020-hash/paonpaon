import {
  asId,
  type Alteration,
  type AlterationId,
  type CustomerId,
  type OrderLineId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AlterationRow = Database["public"]["Tables"]["alterations"]["Row"];

function toDomain(row: AlterationRow): Alteration {
  return {
    id: asId<"AlterationId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.order_line_id
      ? { orderLineId: asId<"OrderLineId">(row.order_line_id) }
      : {}),
    status: row.status,
    ...(row.tailor_reference ? { tailorReference: row.tailor_reference } : {}),
    instructions: row.instructions,
    ...(row.appointment_id_for_fitting
      ? {
          appointmentIdForFitting: asId<"AppointmentId">(
            row.appointment_id_for_fitting,
          ),
        }
      : {}),
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateAlterationParams {
  retailerId: RetailerId;
  customerId: CustomerId;
  instructions: string;
  orderLineId?: OrderLineId;
  dueDate?: string;
}

/**
 * `status` is never written here — see docs/DECISIONS.md ADR-015 and
 * the `enforce_alteration_status_via_updates_only` trigger. Use
 * `AlterationUpdateRepository.add` to move an alteration through its
 * lifecycle.
 */
export class AlterationRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: AlterationId): Promise<Alteration | null> {
    const { data, error } = await this.client
      .from("alterations")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async findByRetailer(retailerId: RetailerId): Promise<Alteration[]> {
    const { data, error } = await this.client
      .from("alterations")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async findByCustomer(customerId: CustomerId): Promise<Alteration[]> {
    const { data, error } = await this.client
      .from("alterations")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(params: CreateAlterationParams): Promise<Alteration> {
    const { data, error } = await this.client
      .from("alterations")
      .insert({
        retailer_id: params.retailerId,
        customer_id: params.customerId,
        instructions: params.instructions,
        order_line_id: params.orderLineId ?? null,
        due_date: params.dueDate ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }
}
