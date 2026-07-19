import {
  asId,
  type Appointment,
  type AppointmentId,
  type AppointmentType,
  type CustomerId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type AppointmentRow = Database["public"]["Tables"]["appointments"]["Row"];

function toDomain(row: AppointmentRow): Appointment {
  return {
    id: asId<"AppointmentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.staff_id ? { staffId: asId<"StaffId">(row.staff_id) } : {}),
    type: row.type,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    ...(row.location_id ? { locationId: row.location_id } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateAppointmentParams {
  retailerId: RetailerId;
  customerId: CustomerId;
  type: AppointmentType;
  startsAt: string;
  endsAt: string;
  staffId?: StaffId;
  notes?: string;
}

export interface UpdateAppointmentParams {
  status?: Appointment["status"];
  staffId?: StaffId;
}

/**
 * Direct staff-initiated bookings (e.g. a walk-in) use `create` under
 * the sales_associate+ RLS policy on `appointments`. Customer-initiated
 * requests always go through `requestAppointment` (the `request_appointment`
 * RPC) instead — see docs/DECISIONS.md ADR-015.
 */
export class AppointmentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: AppointmentId): Promise<Appointment | null> {
    const { data, error } = await this.client
      .from("appointments")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async findByRetailer(retailerId: RetailerId): Promise<Appointment[]> {
    const { data, error } = await this.client
      .from("appointments")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async findByCustomer(customerId: CustomerId): Promise<Appointment[]> {
    const { data, error } = await this.client
      .from("appointments")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("starts_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(params: CreateAppointmentParams): Promise<Appointment> {
    const { data, error } = await this.client
      .from("appointments")
      .insert({
        retailer_id: params.retailerId,
        customer_id: params.customerId,
        type: params.type,
        starts_at: params.startsAt,
        ends_at: params.endsAt,
        staff_id: params.staffId ?? null,
        notes: params.notes ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  async update(
    id: AppointmentId,
    params: UpdateAppointmentParams,
  ): Promise<Appointment> {
    const { data, error } = await this.client
      .from("appointments")
      .update({
        ...(params.status !== undefined ? { status: params.status } : {}),
        ...(params.staffId !== undefined ? { staff_id: params.staffId } : {}),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  /** Calls `request_appointment` — see docs/DECISIONS.md ADR-015. Returns the new appointment's id. */
  async requestAppointment(params: {
    retailerId: RetailerId;
    type: AppointmentType;
    startsAt: string;
    endsAt: string;
    notes?: string;
  }): Promise<AppointmentId> {
    const { data, error } = await this.client.rpc("request_appointment", {
      p_retailer_id: params.retailerId,
      p_type: params.type,
      p_starts_at: params.startsAt,
      p_ends_at: params.endsAt,
      p_notes: params.notes ?? null,
    });

    if (error) {
      throw error;
    }

    return asId<"AppointmentId">(data);
  }
}
