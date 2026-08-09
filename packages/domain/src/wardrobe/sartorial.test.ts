import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import { createSartorialRuleInputSchema } from "./roadmap.schema";
import {
  complementarySlotKindsFor,
  evaluateOutfitCompatibility,
  garmentCategoryToOutfitSlot,
  isApprovedSartorialRule,
  isCompleteLookCovered,
  type OutfitSlotFact,
  type SartorialRule,
} from "./sartorial";
import { NEUTRAL_SARTORIAL_RULE_FIXTURES } from "./sartorial-fixtures";

const retailer = asId<"RetailerId">("00000000-0000-4000-8000-000000000001");
const jacketItem = asId<"WardrobeItemId">(
  "00000000-0000-4000-8000-000000000101",
);
const trousersProduct = asId<"ProductId">(
  "00000000-0000-4000-8000-000000000102",
);

function slot(
  partial: Omit<OutfitSlotFact, "conceptIds"> & {
    readonly conceptIds?: OutfitSlotFact["conceptIds"];
  },
): OutfitSlotFact {
  return { conceptIds: [], ...partial };
}

describe("garmentCategoryToOutfitSlot", () => {
  it("maps ROAD-002 complete-look categories", () => {
    expect(garmentCategoryToOutfitSlot("jacket")).toBe("jacket");
    expect(garmentCategoryToOutfitSlot("trousers")).toBe("trousers");
    expect(garmentCategoryToOutfitSlot("shirt")).toBe("shirt");
    expect(garmentCategoryToOutfitSlot("shoes")).toBe("shoes");
    expect(garmentCategoryToOutfitSlot("pocket_square")).toBe("pocket_square");
    expect(garmentCategoryToOutfitSlot("accessories")).toBe("accessories");
    expect(garmentCategoryToOutfitSlot("other")).toBeNull();
  });
});

describe("evaluateOutfitCompatibility", () => {
  const completeSlots: readonly OutfitSlotFact[] = [
    slot({
      slotKind: "jacket",
      label: "Navy jacket",
      available: true,
      wardrobeItemId: jacketItem,
    }),
    slot({
      slotKind: "trousers",
      label: "Grey trousers",
      available: true,
      productId: trousersProduct,
    }),
    slot({
      slotKind: "shirt",
      label: "White shirt",
      available: true,
      productId: asId<"ProductId">("00000000-0000-4000-8000-000000000103"),
    }),
    slot({
      slotKind: "shoes",
      label: "Black oxfords",
      available: true,
      wardrobeItemId: asId<"WardrobeItemId">(
        "00000000-0000-4000-8000-000000000104",
      ),
    }),
    slot({
      slotKind: "accessories",
      label: "Silk tie",
      available: true,
      productId: asId<"ProductId">("00000000-0000-4000-8000-000000000105"),
    }),
    slot({
      slotKind: "pocket_square",
      label: "Linen pocket square",
      available: true,
      productId: asId<"ProductId">("00000000-0000-4000-8000-000000000106"),
    }),
  ];

  it("cites approved rules and owned/catalogue facts for compatible pairs", () => {
    const claims = evaluateOutfitCompatibility({
      retailerId: retailer,
      slots: completeSlots,
      approvedRules: NEUTRAL_SARTORIAL_RULE_FIXTURES,
    });

    expect(isCompleteLookCovered(completeSlots)).toBe(true);
    expect(claims.every((claim) => claim.status === "compatible")).toBe(true);

    const jacketTrousers = claims.find(
      (claim) =>
        claim.subjectSlotKind === "jacket" &&
        claim.objectSlotKind === "trousers",
    );
    expect(jacketTrousers?.rules.length).toBeGreaterThan(0);
    expect(
      jacketTrousers?.facts.some((f) => f.sourceKind === "wardrobe_item"),
    ).toBe(true);
    expect(
      jacketTrousers?.facts.some((f) => f.sourceKind === "catalogue_product"),
    ).toBe(true);
  });

  it("marks unavailable items without inventing compatibility", () => {
    const claims = evaluateOutfitCompatibility({
      retailerId: retailer,
      slots: completeSlots.map((entry) =>
        entry.slotKind === "shoes"
          ? {
              slotKind: entry.slotKind,
              label: entry.label,
              available: false,
              conceptIds: entry.conceptIds,
            }
          : entry,
      ),
      approvedRules: NEUTRAL_SARTORIAL_RULE_FIXTURES,
    });

    const shoesClaim = claims.find(
      (claim) =>
        claim.subjectSlotKind === "jacket" && claim.objectSlotKind === "shoes",
    );
    expect(shoesClaim?.status).toBe("unavailable");
    expect(shoesClaim?.rules).toEqual([]);
  });

  it("fails closed when no approved rule covers a pairing", () => {
    const claims = evaluateOutfitCompatibility({
      retailerId: retailer,
      slots: completeSlots,
      approvedRules: [],
    });
    expect(claims.every((claim) => claim.status === "unfounded")).toBe(true);
  });

  it("surfaces conflicts from accepted incompatible rules", () => {
    const conflictRule: SartorialRule = {
      ...NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!,
      id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a099"),
      relation: "incompatible",
      explanation: "Approved rule: these slots conflict for this retailer.",
    };
    const claims = evaluateOutfitCompatibility({
      retailerId: retailer,
      slots: completeSlots,
      approvedRules: [conflictRule],
    });
    const jacketTrousers = claims.find(
      (claim) =>
        claim.subjectSlotKind === "jacket" &&
        claim.objectSlotKind === "trousers",
    );
    expect(jacketTrousers?.status).toBe("conflict");
  });

  it("ignores pending and cross-tenant retailer rules", () => {
    const pending = {
      ...NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!,
      reviewStatus: "pending" as const,
    };
    expect(isApprovedSartorialRule(pending)).toBe(false);

    const otherRetailerRule: SartorialRule = {
      ...NEUTRAL_SARTORIAL_RULE_FIXTURES[0]!,
      id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000a098"),
      ownershipKind: "retailer",
      retailerId: asId<"RetailerId">("00000000-0000-4000-8000-000000000099"),
    };
    const claims = evaluateOutfitCompatibility({
      retailerId: retailer,
      slots: completeSlots.slice(0, 2),
      approvedRules: [otherRetailerRule],
    });
    expect(
      claims.find(
        (claim) =>
          claim.subjectSlotKind === "jacket" &&
          claim.objectSlotKind === "trousers",
      )?.status,
    ).toBe("unfounded");
  });
});

describe("complementarySlotKindsFor", () => {
  it("returns every slot an approved canonical rule pairs with jacket", () => {
    const result = complementarySlotKindsFor({
      slotKind: "jacket",
      retailerId: retailer,
      approvedRules: NEUTRAL_SARTORIAL_RULE_FIXTURES,
    });
    expect(new Set(result)).toEqual(
      new Set(["trousers", "shirt", "shoes", "pocket_square"]),
    );
  });

  it("fails closed with no approved rules", () => {
    expect(
      complementarySlotKindsFor({
        slotKind: "jacket",
        retailerId: retailer,
        approvedRules: [],
      }),
    ).toEqual([]);
  });

  it("ignores an incompatible-relation rule", () => {
    const conflictRule: SartorialRule = {
      id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000c001"),
      ownershipKind: "canonical",
      slug: "jacket-shoes-conflict",
      title: "Conflict fixture",
      summary: "Conflict fixture",
      ruleKind: "slot_compatibility",
      relation: "incompatible",
      subjectSlotKind: "jacket",
      objectSlotKind: "shoes",
      explanation: "Fixture-only conflict.",
      reviewStatus: "accepted",
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    };
    expect(
      complementarySlotKindsFor({
        slotKind: "jacket",
        retailerId: retailer,
        approvedRules: [conflictRule],
      }),
    ).toEqual([]);
  });

  it("ignores a canonical rule scoped to another retailer's local rule", () => {
    const otherRetailerRule: SartorialRule = {
      id: asId<"SartorialRuleId">("00000000-0000-4000-8000-00000000c002"),
      ownershipKind: "retailer",
      retailerId: asId<"RetailerId">("00000000-0000-4000-8000-000000000099"),
      slug: "jacket-trousers-other-retailer",
      title: "Other retailer fixture",
      summary: "Other retailer fixture",
      ruleKind: "slot_compatibility",
      relation: "compatible",
      subjectSlotKind: "jacket",
      objectSlotKind: "trousers",
      explanation: "Fixture-only.",
      reviewStatus: "accepted",
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
    };
    expect(
      complementarySlotKindsFor({
        slotKind: "jacket",
        retailerId: retailer,
        approvedRules: [otherRetailerRule],
      }),
    ).toEqual([]);
  });
});

describe("createSartorialRuleInputSchema", () => {
  it("requires slot kinds for slot compatibility rules", () => {
    const parsed = createSartorialRuleInputSchema.safeParse({
      ownershipKind: "canonical",
      slug: "missing-slots",
      title: "Incomplete",
      summary: "Needs slots",
      ruleKind: "slot_compatibility",
      relation: "compatible",
      explanation: "Should fail without slots.",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a canonical slot rule", () => {
    const parsed = createSartorialRuleInputSchema.safeParse({
      ownershipKind: "canonical",
      slug: "jacket-trousers-ok",
      title: "Jacket with trousers",
      summary: "Foundation pair",
      ruleKind: "slot_compatibility",
      relation: "compatible",
      subjectSlotKind: "jacket",
      objectSlotKind: "trousers",
      explanation: "Approved pairing.",
    });
    expect(parsed.success).toBe(true);
  });
});
