import { describe, expect, it } from "vitest";

import {
  createCheckoutSessionInputSchema,
  updatePlatformFeeInputSchema,
} from "./payment.schema";

describe("createCheckoutSessionInputSchema", () => {
  it("accepts a valid order id", () => {
    const result = createCheckoutSessionInputSchema.safeParse({
      orderId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid order id", () => {
    const result = createCheckoutSessionInputSchema.safeParse({
      orderId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("updatePlatformFeeInputSchema", () => {
  it("accepts a valid basis-points fee", () => {
    const result = updatePlatformFeeInputSchema.parse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      platformFeeBasisPoints: "250",
    });
    expect(result.platformFeeBasisPoints).toBe(250);
  });

  it("rejects a fee above 10000 basis points (100%)", () => {
    const result = updatePlatformFeeInputSchema.safeParse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      platformFeeBasisPoints: 10001,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative fee", () => {
    const result = updatePlatformFeeInputSchema.safeParse({
      retailerId: "11111111-1111-1111-1111-111111111111",
      platformFeeBasisPoints: -1,
    });
    expect(result.success).toBe(false);
  });
});
