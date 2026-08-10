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

import { CampaignRepository } from "./campaign-repository";
import { ClientelingOpportunityRepository } from "./clienteling-opportunity-repository";

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
      .neq("status", "draft")
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
      .neq("status", "draft")
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

    const orderId = asId<"OrderId">(data);

    // Automatic order-outcome linking for campaign missions (PHASE 10.1).
    // Wrap in try/catch so a bug in linking can never fail the order.
    try {
      await this.linkCampaignOutcomeIfApplicable(params.retailerId, orderId);
    } catch (e) {
      // Log but don't rethrow — linking is a best-effort side effect
      console.error("Campaign outcome linking failed:", e);
    }

    return orderId;
  }

  private async linkCampaignOutcomeIfApplicable(
    retailerId: RetailerId,
    orderId: OrderId,
  ): Promise<void> {
    // Get the new order to extract customer_id
    const order = await this.findById(orderId);
    if (!order) return; // Should not happen, but be safe

    // Look up first order line to get the product
    const lines = await this.findLinesByOrder(orderId);
    if (lines.length === 0) return; // No lines, nothing to match

    const firstLineVariantId = lines[0]!.productVariantId;

    // Get the variant to find the product
    const { data: variant, error: variantError } = await this.client
      .from("product_variants")
      .select("product_id")
      .eq("id", firstLineVariantId)
      .maybeSingle();

    if (variantError || !variant) return; // Variant not found, skip linking

    const productId = variant.product_id;

    // Look up open campaign mission for this customer
    const opportunity = await new ClientelingOpportunityRepository(
      this.client,
    ).findOpenCampaignMission(retailerId, order.customerId);

    if (!opportunity || !opportunity.campaignId) return; // No open mission, nothing to link

    // Check if the ordered product is in the campaign's target products
    const targetProducts = await new CampaignRepository(
      this.client,
    ).listTargetProducts(opportunity.campaignId);

    const isTargeted = targetProducts.some((t) => t.productId === productId);
    if (!isTargeted) return; // Product not in targets, skip linking

    // Link the outcome — use linkOutcome without status param to default to "completed"
    await new ClientelingOpportunityRepository(this.client).linkOutcome({
      retailerId,
      opportunityId: opportunity.id,
      outcomeOrderId: orderId,
    });
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

  async findCart(
    retailerId: RetailerId,
    customerId: CustomerId,
  ): Promise<Order | null> {
    const { data, error } = await this.client
      .from("orders")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .eq("status", "draft")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  async addToCart(params: {
    retailerId: RetailerId;
    productVariantId: string;
    quantity: number;
  }): Promise<OrderId> {
    const { data, error } = await this.client.rpc("add_to_cart", {
      p_retailer_id: params.retailerId,
      p_variant_id: params.productVariantId,
      p_quantity: params.quantity,
    });
    if (error) throw error;
    return asId<"OrderId">(data);
  }

  async updateCartLine(lineId: string, quantity: number): Promise<void> {
    const { error } = await this.client.rpc("update_cart_line", {
      p_line_id: lineId,
      p_quantity: quantity,
    });
    if (error) throw error;
  }

  async checkoutCart(
    orderId: OrderId,
    shippingAddress: Address,
  ): Promise<OrderId> {
    const { data, error } = await this.client.rpc("checkout_cart", {
      p_order_id: orderId,
      p_shipping_address:
        shippingAddress as unknown as Database["public"]["Functions"]["checkout_cart"]["Args"]["p_shipping_address"],
    });
    if (error) throw error;
    return asId<"OrderId">(data);
  }
}
