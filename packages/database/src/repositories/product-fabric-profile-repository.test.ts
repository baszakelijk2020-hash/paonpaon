import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { ProductFabricProfileRepository } from "./product-fabric-profile-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type FabricProfileRow =
  Database["public"]["Tables"]["product_fabric_profiles"]["Row"];
type FabricCompositionRow =
  Database["public"]["Tables"]["product_fabric_composition"]["Row"];

const retailerId = "11111111-1111-1111-1111-111111111111";
const productId = "22222222-2222-2222-2222-222222222222";
const profileId = "33333333-3333-3333-3333-333333333333";
const woolId = "44444444-4444-4444-4444-444444444444";
const silkId = "55555555-5555-5555-5555-555555555555";

const profileRow: FabricProfileRow = {
  id: profileId,
  retailer_id: retailerId,
  product_id: productId,
  product_variant_id: null,
  fabric_weight_grams_per_square_metre: 285,
  supplier_reference: "MILL-2026-42",
  created_at: "2026-07-29T00:00:00.000Z",
  updated_at: "2026-07-29T00:00:00.000Z",
  deleted_at: null,
};

const compositionRows: FabricCompositionRow[] = [
  {
    profile_id: profileId,
    retailer_id: retailerId,
    fibre_concept_id: woolId,
    percentage: 90,
    created_at: "2026-07-29T00:00:00.000Z",
    updated_at: "2026-07-29T00:00:00.000Z",
  },
  {
    profile_id: profileId,
    retailer_id: retailerId,
    fibre_concept_id: silkId,
    percentage: 10,
    created_at: "2026-07-29T00:00:00.000Z",
    updated_at: "2026-07-29T00:00:00.000Z",
  },
];

function clientWithProfile(rpc = vi.fn()) {
  return {
    from: (table: string) =>
      table === "product_fabric_profiles"
        ? fakeQueryBuilder({ data: profileRow, error: null })
        : fakeQueryBuilder({ data: compositionRows, error: null }),
    rpc,
  } as unknown as PaonSupabaseClient;
}

describe("ProductFabricProfileRepository", () => {
  it("maps exact composition, weight, and supplier reference", async () => {
    const profile = await new ProductFabricProfileRepository(
      clientWithProfile(),
    ).findForProduct(retailerId as never, productId as never);

    expect(profile).toEqual({
      fabricWeightGramsPerSquareMetre: 285,
      composition: [
        { fibreConceptId: woolId, percentage: 90 },
        { fibreConceptId: silkId, percentage: 10 },
      ],
      supplierReference: "MILL-2026-42",
    });
  });

  it("uses the atomic RPC and reloads a product-level profile", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: profileId, error: null });
    const repository = new ProductFabricProfileRepository(
      clientWithProfile(rpc),
    );

    await repository.setForProduct(retailerId as never, productId as never, {
      fabricWeightGramsPerSquareMetre: 285,
      composition: [
        { fibreConceptId: woolId, percentage: 90 },
        { fibreConceptId: silkId, percentage: 10 },
      ],
      supplierReference: "MILL-2026-42",
    });

    expect(rpc).toHaveBeenCalledWith("set_product_fabric_profile", {
      p_product_id: productId,
      p_composition: [
        { fibreConceptId: woolId, percentage: 90 },
        { fibreConceptId: silkId, percentage: 10 },
      ],
      p_fabric_weight_grams_per_square_metre: 285,
      p_supplier_reference: "MILL-2026-42",
    });
  });

  it("rejects incomplete composition before making a database call", async () => {
    const rpc = vi.fn();
    const repository = new ProductFabricProfileRepository(
      clientWithProfile(rpc),
    );

    await expect(
      repository.setForProduct(retailerId as never, productId as never, {
        composition: [{ fibreConceptId: woolId, percentage: 90 }],
      }),
    ).rejects.toThrow("Composition percentages must total exactly 100");
    expect(rpc).not.toHaveBeenCalled();
  });
});
