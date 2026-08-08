import {
  asId,
  isManagementRole,
  maskEmail,
  maskPhone,
  type Address,
  type Customer,
  type CustomerLifecycleStage,
  type CustomerId,
  type PreferredCarrier,
  type RetailerId,
  type RetailerRole,
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
    ...(row.preferred_carrier
      ? { preferredCarrier: row.preferred_carrier as PreferredCarrier }
      : {}),
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

  /**
   * The staff-facing customer list/search surface (ADR-074 Slice 1). RLS
   * still returns every tenant row — full-row hiding would also hide
   * unassigned customers from the coverage/handoff workflows that
   * legitimately need minimal identification — so masking of contact
   * detail happens here, server-side, before the result ever reaches a
   * Server Component or Server Action response. Unassigned + non-
   * management staff see masked `email`/`phone`; everyone else (the
   * assigned advisor, or manager/admin/owner) sees the real value. This
   * is the search/list path specifically; `findById`'s callers include
   * non-staff-viewer contexts (checkout, the customer's own portal,
   * background jobs) that must keep receiving real values unchanged.
   */
  async findByRetailerForStaffView(
    retailerId: RetailerId,
    viewer: { staffId: StaffId | undefined; role: RetailerRole },
  ): Promise<Customer[]> {
    const customers = await this.findByRetailer(retailerId);
    if (isManagementRole(viewer.role)) return customers;

    return customers.map((customer) => {
      if (customer.assignedStaffId === viewer.staffId) return customer;
      return {
        ...customer,
        ...(customer.email ? { email: maskEmail(customer.email) } : {}),
        ...(customer.phone ? { phone: maskPhone(customer.phone) } : {}),
      };
    });
  }

  /** First (oldest) matching customer row for this retailer + email —
   * `email` has no uniqueness constraint on this table, so this reuses
   * the earliest-known relationship rather than assuming there is only
   * one. Used to avoid creating a duplicate prospect for someone who
   * already has a real relationship on file. */
  async findByEmail(
    retailerId: RetailerId,
    email: string,
  ): Promise<Customer | null> {
    const { data, error } = await this.client
      .from("customers")
      .select("*")
      .eq("retailer_id", retailerId)
      .ilike("email", email)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
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

  /** Direct table write — `customers` already grants sales_associate+
   * a blanket `for all` RLS policy (20260719000007_*), so this needs
   * no RPC, unlike `CustomerPreferences` which only the customer
   * themselves can write. */
  async updatePreferredCarrier(
    id: CustomerId,
    preferredCarrier: PreferredCarrier | null,
  ): Promise<void> {
    const { error } = await this.client
      .from("customers")
      .update({ preferred_carrier: preferredCarrier })
      .eq("id", id);
    if (error) throw error;
  }

  /**
   * "1-Tap Checkout" eligibility. Unlike `updatePreferredCarrier`, the
   * customer's own session — not staff — is the only caller here, so this
   * goes through `update_my_default_shipping_address` (re-derives the
   * caller's own customer row server-side) rather than a direct table
   * write `customers` has no self-service RLS grant for.
   */
  async updateMyDefaultShippingAddress(
    retailerId: RetailerId,
    address: Address,
  ): Promise<void> {
    const { error } = await this.client.rpc(
      "update_my_default_shipping_address",
      {
        p_retailer_id: retailerId,
        p_address:
          address as unknown as Database["public"]["Functions"]["update_my_default_shipping_address"]["Args"]["p_address"],
      },
    );
    if (error) throw error;
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
