import { describe, expect, it } from "vitest";

import {
  checkoutCartInputSchema,
  placeOrderInputSchema,
  updateCartLineInputSchema,
  updateOrderStatusInputSchema,
} from "./order.schema";

describe("placeOrderInputSchema", () => {
  it("coerces quantity from a form-data string", () => {
    const result = placeOrderInputSchema.parse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      productVariantId: "22222222-2222-2222-2222-222222222222",
      quantity: "2",
    });
    expect(result.quantity).toBe(2);
  });

  it("rejects a quantity of zero", () => {
    const result = placeOrderInputSchema.safeParse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      productVariantId: "22222222-2222-2222-2222-222222222222",
      quantity: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity above 20", () => {
    const result = placeOrderInputSchema.safeParse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      productVariantId: "22222222-2222-2222-2222-222222222222",
      quantity: "21",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid retailerId", () => {
    const result = placeOrderInputSchema.safeParse({
      retailerId: "not-a-uuid",
      productVariantId: "22222222-2222-2222-2222-222222222222",
      quantity: "1",
    });
    expect(result.success).toBe(false);
  });
});

describe("cart schemas", () => {
  it("accepts removal via quantity zero and rejects negative quantities", () => {
    expect(
      updateCartLineInputSchema.safeParse({
        lineId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        quantity: "0",
      }).success,
    ).toBe(true);
    expect(
      updateCartLineInputSchema.safeParse({
        lineId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        quantity: "-1",
      }).success,
    ).toBe(false);
  });

  it("requires a complete checkout shipping address", () => {
    expect(
      checkoutCartInputSchema.safeParse({
        orderId: "99999999-9999-9999-9999-999999999999",
        shippingAddress: {
          line1: "1 Tailor Street",
          city: "Amsterdam",
          postalCode: "1011AA",
          countryCode: "NL",
        },
      }).success,
    ).toBe(true);
    expect(
      checkoutCartInputSchema.safeParse({
        orderId: "99999999-9999-9999-9999-999999999999",
        shippingAddress: { city: "Amsterdam" },
      }).success,
    ).toBe(false);
  });
});

describe("updateOrderStatusInputSchema", () => {
  it("accepts every valid OrderStatus", () => {
    const result = updateOrderStatusInputSchema.safeParse({
      status: "shipped",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = updateOrderStatusInputSchema.safeParse({
      status: "shipped_and_forgotten",
    });
    expect(result.success).toBe(false);
  });
});
