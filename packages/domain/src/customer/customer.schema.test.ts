import { describe, expect, it } from "vitest";

import { createCustomerInputSchema } from "./customer.schema";

describe("createCustomerInputSchema", () => {
  it("accepts a minimal payload and defaults lifecycleStage to prospect", () => {
    const result = createCustomerInputSchema.parse({
      fullName: "Jane Shopper",
    });
    expect(result.lifecycleStage).toBe("prospect");
    expect(result.email).toBeUndefined();
  });

  it("normalizes email casing", () => {
    const result = createCustomerInputSchema.parse({
      fullName: "Jane Shopper",
      email: "Jane@Example.com",
    });
    expect(result.email).toBe("jane@example.com");
  });

  it("rejects an invalid email", () => {
    const result = createCustomerInputSchema.safeParse({
      fullName: "Jane Shopper",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing full name", () => {
    const result = createCustomerInputSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported lifecycle stage", () => {
    const result = createCustomerInputSchema.safeParse({
      fullName: "Jane Shopper",
      lifecycleStage: "regular",
    });
    expect(result.success).toBe(false);
  });
});
