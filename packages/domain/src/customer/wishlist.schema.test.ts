import { describe, expect, it } from "vitest";

import { toggleWishlistItemInputSchema } from "./wishlist.schema";

describe("toggleWishlistItemInputSchema", () => {
  it("accepts a valid retailer and variant id pair", () => {
    const result = toggleWishlistItemInputSchema.safeParse({
      retailerId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      productVariantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    const result = toggleWishlistItemInputSchema.safeParse({
      retailerId: "not-a-uuid",
      productVariantId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    });
    expect(result.success).toBe(false);
  });
});
