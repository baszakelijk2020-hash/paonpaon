import {
  asId,
  money,
  type Address,
  type CurrencyCode,
  type CustomerId,
  type Order,
  type OrderId,
  type OrderLine,
  type OrderStatus,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderLineRow = Database["public"]["Tables"]["order_lines"]["Row"];

function toDomain(row: OrderRow): Order {
  return {
    id: asId<"OrderId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    orderNumber: row.order_number,
    status: row.status,
    channel: row.channel,
    currency: row.currency,
    subtotal: money(
      row.subtotal_amount_minor_units,
      row.currency as CurrencyCode,
    ),
    total: money(row.total_amount_minor_units, row.currency as CurrencyCode),
    ...(row.shipping_address
      ? { shippingAddress: row.shipping_address as unknown as Address }
      : {}),
    ...(row.placed_at ? { placedAt: row.placed_at } : {}),
    ...(row.staff_id ? { staffId: row.staff_id } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function lineToDomain(row: OrderLineRow): OrderLine {
  return {
    id: asId<"OrderLineId">(row.id),
    orderId: asId<"OrderId">(row.order_id),
    productVariantId: asId<"ProductVariantId">(row.product_variant_id),
    quantity: row.quantity,
    unitPrice: money(
      row.unit_price_amount_minor_units,
      row.unit_price_currency as CurrencyCode,
    ),
    requiresProduction: row.requires_production,
    requiresAlteration: row.requires_alteration,
  };
}

/**
 * Order/line *creation* only ever happens through the `place_order`
 * RPC (see docs/DECISIONS.md ADR-014) — this repository never inserts
 * either table directly. `updateStatus` is the one exception to
 * "read-only": fulfillment status transitions are a direct `update`,
 * gated by the `production_staff`+ RLS policy on `orders`
 * (`20260719000012_*`), not by a further RPC — there's no
 * client-supplied price/inventory/customer_id to re-derive here the
 * way there was for creation.
 */
export class OrderRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: OrderId): Promise<Order | null> {
    const { data, error } = await this.client
      .from("orders")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? toDomain(data) : null;
  }

  async findByRetailer(retailerId: RetailerId): Promise<Order[]> {
    const { data, error } = await this.client
      .from("orders")
      .select("*")
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async findByCustomer(customerId: CustomerId): Promise<Order[]> {
    const { data, error } = await this.client
      .from("orders")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data.map(toDomain);
  }

  async findLinesByOrder(orderId: OrderId): Promise<OrderLine[]> {
    const { data, error } = await this.client
      .from("order_lines")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return data.map(lineToDomain);
  }

  /** Calls `place_order` — see docs/DECISIONS.md ADR-014. Returns the new order's id. */
  async placeOrder(params: {
    retailerId: RetailerId;
    productVariantId: string;
    quantity: number;
  }): Promise<OrderId> {
    const { data, error } = await this.client.rpc("place_order", {
      p_retailer_id: params.retailerId,
      p_variant_id: params.productVariantId,
      p_quantity: params.quantity,
    });

    if (error) {
      throw error;
    }

    return asId<"OrderId">(data);
  }

  async updateStatus(id: OrderId, status: OrderStatus): Promise<Order> {
    const { data, error } = await this.client
      .from("orders")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return toDomain(data);
  }
}
