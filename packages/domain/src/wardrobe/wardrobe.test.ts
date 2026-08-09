import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  canCollaborateOnWardrobe,
  isWardrobeItemConsistent,
  wardrobeItemConsistencyIssues,
  wardrobeServiceRequestMessage,
} from "./wardrobe";
import {
  createCatalogueWardrobeItemInputSchema,
  createExternalWardrobeItemInputSchema,
} from "./wardrobe.schema";

const retailerA = asId<"RetailerId">("00000000-0000-4000-8000-000000000001");
const retailerB = asId<"RetailerId">("00000000-0000-4000-8000-000000000002");
const customerA = asId<"CustomerId">("00000000-0000-4000-8000-000000000011");
const customerB = asId<"CustomerId">("00000000-0000-4000-8000-000000000012");
const orderLine = asId<"OrderLineId">("00000000-0000-4000-8000-000000000021");
const staff = asId<"StaffId">("00000000-0000-4000-8000-000000000031");

describe("wardrobe item ownership schemas", () => {
  it("accepts an external customer-added item without catalogue clone fields", () => {
    const parsed = createExternalWardrobeItemInputSchema.safeParse({
      retailerId: retailerA,
      customerId: customerA,
      categoryCode: "jacket",
      displayName: "Navy blazer from another house",
      brand: "Private label",
      condition: "good",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a retailer-purchased catalogue-linked item", () => {
    const parsed = createCatalogueWardrobeItemInputSchema.safeParse({
      retailerId: retailerA,
      customerId: customerA,
      categoryCode: "trousers",
      displayName: "Smoke-grey twill trousers",
      productId: "00000000-0000-4000-8000-000000000041",
      orderLineId: orderLine,
      condition: "new",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid enums on external items", () => {
    const parsed = createExternalWardrobeItemInputSchema.safeParse({
      retailerId: retailerA,
      customerId: customerA,
      categoryCode: "spacesuit",
      displayName: "Nope",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("wardrobeItemConsistencyIssues", () => {
  it("keeps external items free of order lines and purchase provenance", () => {
    expect(
      wardrobeItemConsistencyIssues({
        ownershipKind: "external",
        provenanceSource: "customer_added",
        orderLineId: orderLine,
        createdByActor: "customer",
        condition: "good",
      }),
    ).toContain("external_cannot_have_order_line");

    expect(
      wardrobeItemConsistencyIssues({
        ownershipKind: "external",
        provenanceSource: "order_line",
        createdByActor: "customer",
        condition: "good",
      }),
    ).toEqual(
      expect.arrayContaining([
        "external_provenance_invalid",
        "order_line_provenance_requires_order_line",
      ]),
    );
  });

  it("requires order-line provenance to carry an order line", () => {
    expect(
      isWardrobeItemConsistent({
        ownershipKind: "retailer_purchased",
        provenanceSource: "order_line",
        orderLineId: orderLine,
        createdByActor: "advisor",
        createdByStaffId: staff,
        condition: "new",
      }),
    ).toBe(true);

    expect(
      wardrobeItemConsistencyIssues({
        ownershipKind: "retailer_purchased",
        provenanceSource: "order_line",
        createdByActor: "advisor",
        createdByStaffId: staff,
        condition: "new",
      }),
    ).toContain("order_line_provenance_requires_order_line");
  });

  it("aligns retired condition with retiredAt", () => {
    expect(
      wardrobeItemConsistencyIssues({
        ownershipKind: "external",
        provenanceSource: "customer_added",
        createdByActor: "customer",
        condition: "retired",
        retiredAt: null,
      }),
    ).toContain("retired_condition_mismatch");
  });
});

describe("canCollaborateOnWardrobe role matrix", () => {
  const item = {
    itemRetailerId: retailerA,
    itemCustomerId: customerA,
  };

  it("allows the linked customer and same-tenant advisors", () => {
    expect(
      canCollaborateOnWardrobe({
        ...item,
        action: "update",
        actor: {
          kind: "customer",
          customerId: customerA,
          retailerId: retailerA,
        },
      }),
    ).toBe(true);

    expect(
      canCollaborateOnWardrobe({
        ...item,
        action: "propose_metadata",
        actor: {
          kind: "advisor",
          retailerId: retailerA,
          role: "sales_associate",
        },
      }),
    ).toBe(true);
  });

  it("denies cross-tenant, other customers, workshop roles, and strangers", () => {
    expect(
      canCollaborateOnWardrobe({
        ...item,
        action: "read",
        actor: {
          kind: "customer",
          customerId: customerB,
          retailerId: retailerA,
        },
      }),
    ).toBe(false);

    expect(
      canCollaborateOnWardrobe({
        ...item,
        action: "read",
        actor: {
          kind: "advisor",
          retailerId: retailerB,
          role: "owner",
        },
      }),
    ).toBe(false);

    expect(
      canCollaborateOnWardrobe({
        ...item,
        action: "update",
        actor: {
          kind: "advisor",
          retailerId: retailerA,
          role: "worker",
        },
      }),
    ).toBe(false);

    expect(
      canCollaborateOnWardrobe({
        ...item,
        action: "read",
        actor: { kind: "other" },
      }),
    ).toBe(false);
  });
});

describe("wardrobeServiceRequestMessage", () => {
  it("names the item without a brand", () => {
    expect(
      wardrobeServiceRequestMessage({
        kind: "alteration",
        itemDisplayName: "Navy Wool Overcoat",
      }),
    ).toBe(
      "I'd like to book an alteration for this item from my wardrobe: Navy Wool Overcoat.",
    );
  });

  it("prefixes the brand when set", () => {
    expect(
      wardrobeServiceRequestMessage({
        kind: "cleaning",
        itemDisplayName: "Overcoat",
        itemBrand: "Cifonelli",
      }),
    ).toBe(
      "I'd like to book a cleaning for this item from my wardrobe: Cifonelli Overcoat.",
    );
  });
});
