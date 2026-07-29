import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  isSelfScanEligible,
  selfReportToOfficialObservationForbidden,
  WARDROBE_SELF_REPORT_PROVENANCE,
} from "./self-scan";

describe("isSelfScanEligible", () => {
  const customerId = asId<"CustomerId">("22222222-2222-4222-8222-222222222222");

  it("allows retailer-purchased items with fulfilled order lines", () => {
    const result = isSelfScanEligible({
      item: {
        id: asId<"WardrobeItemId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
        customerId,
        retailerId: asId<"RetailerId">("11111111-1111-4111-8111-111111111111"),
        ownershipKind: "retailer_purchased",
        orderLineId: asId<"OrderLineId">(
          "44444444-4444-4444-8444-444444444444",
        ),
        condition: "good",
      },
      customerId,
      orderStatus: "delivered",
    });
    expect(result.eligible).toBe(true);
  });

  it("denies external items without a service link", () => {
    const result = isSelfScanEligible({
      item: {
        id: asId<"WardrobeItemId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
        customerId,
        retailerId: asId<"RetailerId">("11111111-1111-4111-8111-111111111111"),
        ownershipKind: "external",
        condition: "good",
      },
      customerId,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("external_without_service_link");
  });

  it("denies unfulfilled order lines", () => {
    const result = isSelfScanEligible({
      item: {
        id: asId<"WardrobeItemId">("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"),
        customerId,
        retailerId: asId<"RetailerId">("11111111-1111-4111-8111-111111111111"),
        ownershipKind: "retailer_purchased",
        orderLineId: asId<"OrderLineId">(
          "44444444-4444-4444-8444-444444444444",
        ),
        condition: "good",
      },
      customerId,
      orderStatus: "placed",
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe("order_not_fulfilled");
  });
});

describe("selfReportToOfficialObservationForbidden", () => {
  it("marks customer self reports as non-official", () => {
    expect(
      selfReportToOfficialObservationForbidden({
        provenance: WARDROBE_SELF_REPORT_PROVENANCE,
        notes: "Feels tighter in the shoulders",
      }),
    ).toBe(true);
  });
});
