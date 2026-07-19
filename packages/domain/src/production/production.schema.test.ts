import { describe, expect, it } from "vitest";

import {
  addAlterationUpdateInputSchema,
  createAlterationInputSchema,
} from "./production.schema";

describe("createAlterationInputSchema", () => {
  it("accepts a standalone alteration with no orderLineId", () => {
    const result = createAlterationInputSchema.parse({
      customerId: "11111111-1111-1111-1111-111111111111",
      instructions: "Take in the waist by 1 inch.",
    });
    expect(result.orderLineId).toBeUndefined();
  });

  it("accepts an alteration attached to an order line", () => {
    const result = createAlterationInputSchema.parse({
      customerId: "11111111-1111-1111-1111-111111111111",
      orderLineId: "22222222-2222-2222-2222-222222222222",
      instructions: "Hem the trousers.",
      dueDate: "2026-08-01",
    });
    expect(result.orderLineId).toBe("22222222-2222-2222-2222-222222222222");
  });

  it("rejects empty instructions", () => {
    const result = createAlterationInputSchema.safeParse({
      customerId: "11111111-1111-1111-1111-111111111111",
      instructions: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid customerId", () => {
    const result = createAlterationInputSchema.safeParse({
      customerId: "not-a-uuid",
      instructions: "Hem the trousers.",
    });
    expect(result.success).toBe(false);
  });
});

describe("addAlterationUpdateInputSchema", () => {
  it("accepts a status change with no note", () => {
    const result = addAlterationUpdateInputSchema.safeParse({
      status: "in_progress",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a status change with a note", () => {
    const result = addAlterationUpdateInputSchema.parse({
      status: "ready_for_pickup",
      note: "Ready at the front desk.",
    });
    expect(result.note).toBe("Ready at the front desk.");
  });

  it("rejects an unsupported status", () => {
    const result = addAlterationUpdateInputSchema.safeParse({
      status: "shipped",
    });
    expect(result.success).toBe(false);
  });
});
