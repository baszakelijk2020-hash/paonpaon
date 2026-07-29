import { describe, expect, expectTypeOf, it } from "vitest";

import {
  asId,
  type MetadataConceptId,
  type ProductId,
  type ProductVariantId,
  type RetailerId,
  type WardrobeItemId,
} from "../shared/branded-id";

import {
  isMetadataAssignmentTenantCompatible,
  isMetadataEdgeTenantCompatible,
  type MetadataTarget,
} from "./metadata";

const retailerA = asId<"RetailerId">("00000000-0000-4000-8000-000000000001");
const retailerB = asId<"RetailerId">("00000000-0000-4000-8000-000000000002");

describe("metadata branded IDs and targets", () => {
  it("keeps entity and concept IDs nominally distinct", () => {
    expectTypeOf<ProductId>().not.toEqualTypeOf<MetadataConceptId>();
    expectTypeOf<ProductVariantId>().not.toEqualTypeOf<WardrobeItemId>();
  });

  it("keeps target IDs paired with their discriminator", () => {
    expectTypeOf<MetadataTarget>().toMatchTypeOf<
      | { readonly targetType: "product"; readonly targetId: ProductId }
      | {
          readonly targetType: "product_variant";
          readonly targetId: ProductVariantId;
        }
      | {
          readonly targetType: "wardrobe_item";
          readonly targetId: WardrobeItemId;
        }
    >();
  });
});

describe("isMetadataAssignmentTenantCompatible", () => {
  it("allows a canonical concept on a same-retailer target", () => {
    expect(
      isMetadataAssignmentTenantCompatible({
        assignmentRetailerId: retailerA,
        targetRetailerId: retailerA,
        conceptRetailerId: null,
      }),
    ).toBe(true);
  });

  it("allows a same-retailer concept on a same-retailer target", () => {
    expect(
      isMetadataAssignmentTenantCompatible({
        assignmentRetailerId: retailerA,
        targetRetailerId: retailerA,
        conceptRetailerId: retailerA,
      }),
    ).toBe(true);
  });

  it("rejects a target or concept from another retailer", () => {
    expect(
      isMetadataAssignmentTenantCompatible({
        assignmentRetailerId: retailerA,
        targetRetailerId: retailerB,
        conceptRetailerId: null,
      }),
    ).toBe(false);
    expect(
      isMetadataAssignmentTenantCompatible({
        assignmentRetailerId: retailerA,
        targetRetailerId: retailerA,
        conceptRetailerId: retailerB,
      }),
    ).toBe(false);
  });
});

describe("isMetadataEdgeTenantCompatible", () => {
  it("keeps canonical edges between canonical concepts", () => {
    expect(
      isMetadataEdgeTenantCompatible({
        edgeRetailerId: null,
        sourceConceptRetailerId: null,
        targetConceptRetailerId: null,
      }),
    ).toBe(true);
    expect(
      isMetadataEdgeTenantCompatible({
        edgeRetailerId: null,
        sourceConceptRetailerId: null,
        targetConceptRetailerId: retailerA,
      }),
    ).toBe(false);
  });

  it("allows a retailer edge to combine canonical and local concepts", () => {
    expect(
      isMetadataEdgeTenantCompatible({
        edgeRetailerId: retailerA,
        sourceConceptRetailerId: null,
        targetConceptRetailerId: retailerA,
      }),
    ).toBe(true);
  });

  it("rejects concepts owned by another retailer", () => {
    expect(
      isMetadataEdgeTenantCompatible({
        edgeRetailerId: retailerA,
        sourceConceptRetailerId: retailerA,
        targetConceptRetailerId: retailerB,
      }),
    ).toBe(false);
  });
});

expectTypeOf(retailerA).toEqualTypeOf<RetailerId>();
