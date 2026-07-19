import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { OrderRepository } from "./order-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderLineRow = Database["public"]["Tables"]["order_lines"]["Row"];

const orderRow: OrderRow = {
  id: "99999999-9999-9999-9999-999999999999",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  customer_id: "44444444-4444-4444-4444-444444444444",
  order_number: "ORD-000001",
  status: "pending_payment",
  channel: "online",
  currency: "USD",
  subtotal_amount_minor_units: 45000,
  total_amount_minor_units: 45000,
  shipping_address: null,
  placed_at: "2026-01-01T00:00:00.000Z",
  staff_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const orderLineRow: OrderLineRow = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  order_id: orderRow.id,
  product_variant_id: "88888888-8888-8888-8888-888888888888",
  quantity: 1,
  unit_price_amount_minor_units: 45000,
  unit_price_currency: "USD",
  requires_production: false,
  requires_alteration: false,
  created_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("OrderRepository", () => {
  it("maps a row to a domain Order, splitting subtotal/total into Money", async () => {
    const repo = new OrderRepository(
      clientReturning({ data: orderRow, error: null }),
    );
    const order = await repo.findById(orderRow.id as never);

    expect(order?.orderNumber).toBe("ORD-000001");
    expect(order?.status).toBe("pending_payment");
    expect(order?.total).toEqual({ amountMinorUnits: 45000, currency: "USD" });
    expect(order?.shippingAddress).toBeUndefined();
  });

  it("maps a list of rows in findByRetailer() and findByCustomer()", async () => {
    const repo = new OrderRepository(
      clientReturning({ data: [orderRow], error: null }),
    );
    expect(
      await repo.findByRetailer(orderRow.retailer_id as never),
    ).toHaveLength(1);
    expect(
      await repo.findByCustomer(orderRow.customer_id as never),
    ).toHaveLength(1);
  });

  it("maps order lines", async () => {
    const repo = new OrderRepository(
      clientReturning({ data: [orderLineRow], error: null }),
    );
    const lines = await repo.findLinesByOrder(orderRow.id as never);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.unitPrice).toEqual({
      amountMinorUnits: 45000,
      currency: "USD",
    });
  });

  it("placeOrder calls the place_order RPC and returns the new order id", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: orderRow.id, error: null });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new OrderRepository(client);

    const orderId = await repo.placeOrder({
      retailerId: orderRow.retailer_id as never,
      productVariantId: "88888888-8888-8888-8888-888888888888",
      quantity: 1,
    });

    expect(rpc).toHaveBeenCalledWith("place_order", {
      p_retailer_id: orderRow.retailer_id,
      p_variant_id: "88888888-8888-8888-8888-888888888888",
      p_quantity: 1,
    });
    expect(orderId).toBe(orderRow.id);
  });

  it("placeOrder rejects when the RPC errors (e.g. insufficient inventory)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("Not enough stock") });
    const client = { rpc } as unknown as PaonSupabaseClient;
    const repo = new OrderRepository(client);

    await expect(
      repo.placeOrder({
        retailerId: orderRow.retailer_id as never,
        productVariantId: "88888888-8888-8888-8888-888888888888",
        quantity: 100,
      }),
    ).rejects.toBeTruthy();
  });

  it("updateStatus maps the returned row back to a domain Order", async () => {
    const updatedRow: OrderRow = { ...orderRow, status: "shipped" };
    const repo = new OrderRepository(
      clientReturning({ data: updatedRow, error: null }),
    );

    const order = await repo.updateStatus(orderRow.id as never, "shipped");
    expect(order.status).toBe("shipped");
  });
});
