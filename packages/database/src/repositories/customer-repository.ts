import {
  asId,
  type Address,
  type Customer,
  type CustomerLifecycleStage,
  type CustomerId,
  type RetailerId,
  type StaffId,
  type UserId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];

function toDomain(row: CustomerRow): Customer {
  return {
    id: asId<"CustomerId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    ...(row.user_id ? { userId: asId<"UserId">(row.user_id) } : {}),
    fullName: row.full_name,
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    lifecycleStage: row.lifecycle_stage,
    ...(row.assigned_staff_id
      ? { assignedStaffId: asId<"StaffId">(row.assigned_staff_id) }
      : {}),
    shippingAddresses: row.shipping_addresses as unknown as readonly Address[],
    ...(row.acquisition_source
      ? { acquisitionSource: row.acquisition_source }
      : {}),
    tags: row.tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export interface CreateCustomerParams {
  retailerId: RetailerId;
  fullName: string;
  email?: string;
  phone?: string;
  lifecycleStage: CustomerLifecycleStage;
  assignedStaffId?: StaffId;
  acquisitionSource?: string;
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `customers`. */
export class CustomerRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: CustomerId): Promise<Customer | null> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async findByRetailer(retailerId: RetailerId): Promise<Customer[]> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  /** Every `Customer` row linked to this Customer Portal login, across every retailer relationship — see docs/DECISIONS.md ADR-013. */
  async findByUserId(userId: UserId): Promise<Customer[]> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async create(params: CreateCustomerParams): Promise<Customer> {
    const { data, error } = await this.client
      .from("customers")
      .insert({
        retailer_id: params.retailerId,
        full_name: params.fullName,
        email: params.email ?? null,
        phone: params.phone ?? null,
        lifecycle_stage: params.lifecycleStage,
        assigned_staff_id: params.assignedStaffId ?? null,
        acquisition_source: params.acquisitionSource ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }

  /**
   * Calls `link_my_customer_accounts` — see docs/DECISIONS.md ADR-013.
   * Idempotent; call once per Customer Portal session establishment.
   */
  async linkMyAccounts(): Promise<void> {
    const { error } = await this.client.rpc("link_my_customer_accounts");

    if (error) {
      throw error;
    }
  }
}
