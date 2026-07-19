import {
  asId,
  money,
  type AlterationId,
  type CustomerAlterationSummary,
  type CustomerId,
  type CurrencyCode,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type SummaryRow =
  Database["public"]["Views"]["customer_alteration_work_orders"]["Row"];

function toDomain(row: SummaryRow): CustomerAlterationSummary {
  return {
    id: asId<"AlterationId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    workOrderNumber: row.work_order_number,
    status: row.status,
    garmentCategoryCode: row.category_code,
    garmentType: row.garment_type,
    ...(row.brand ? { brand: row.brand } : {}),
    garmentDescription: row.description,
    ...(row.agreed_total_amount_minor_units !== null &&
    row.agreed_total_currency
      ? {
          agreedTotal: money(
            row.agreed_total_amount_minor_units,
            row.agreed_total_currency as CurrencyCode,
          ),
        }
      : {}),
    ...(row.due_date ? { dueDate: row.due_date } : {}),
    ...(row.customer_notification_ready_at
      ? { customerNotificationReadyAt: row.customer_notification_ready_at }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CustomerAlterationRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: AlterationId): Promise<CustomerAlterationSummary | null> {
    const { data, error } = await this.client
      .from("customer_alteration_work_orders")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async findByCustomer(
    customerId: CustomerId,
  ): Promise<CustomerAlterationSummary[]> {
    const { data, error } = await this.client
      .from("customer_alteration_work_orders")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toDomain);
  }

  async findTimeline(alterationId: AlterationId) {
    const { data, error } = await this.client
      .from("customer_alteration_status_history")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  }

  async findFulfillment(alterationId: AlterationId) {
    const { data, error } = await this.client
      .from("customer_alteration_fulfillment")
      .select("*")
      .eq("alteration_id", alterationId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }
}
