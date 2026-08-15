import { describe, expect, it } from "vitest";

import { wearerCustomerLinkState } from "./wearer-customer-link";

describe("wearerCustomerLinkState", () => {
  it("is eligible_to_link when no customerId is set", () => {
    expect(wearerCustomerLinkState({})).toBe("eligible_to_link");
  });

  it("is linked when a customerId is set", () => {
    expect(
      wearerCustomerLinkState({
        customerId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toBe("linked");
  });
});
