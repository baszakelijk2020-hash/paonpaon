import {
  asId,
  productFabricProfileSchema,
  type ProductFabricProfile,
  type ProductFabricProfileInput,
  type ProductId,
  type ProductVariantId,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type FabricProfileRow =
  Database["public"]["Tables"]["product_fabric_profiles"]["Row"];
type FabricCompositionRow =
  Database["public"]["Tables"]["product_fabric_composition"]["Row"];

function toDomain(
  profile: FabricProfileRow,
  composition: FabricCompositionRow[],
): ProductFabricProfile {
  const parsed = productFabricProfileSchema.parse({
    ...(profile.fabric_weight_grams_per_square_metre === null
      ? {}
      : {
          fabricWeightGramsPerSquareMetre:
            profile.fabric_weight_grams_per_square_metre,
        }),
    composition: composition.map((component) => ({
      fibreConceptId: asId<"MetadataConceptId">(component.fibre_concept_id),
      percentage: component.percentage,
    })),
    ...(profile.supplier_reference === null
      ? {}
      : { supplierReference: profile.supplier_reference }),
  });
  return {
    ...(parsed.fabricWeightGramsPerSquareMetre === undefined
      ? {}
      : {
          fabricWeightGramsPerSquareMetre:
            parsed.fabricWeightGramsPerSquareMetre,
        }),
    composition: parsed.composition.map((component) => ({
      fibreConceptId: asId<"MetadataConceptId">(component.fibreConceptId),
      percentage: component.percentage,
    })),
    ...(parsed.supplierReference === undefined
      ? {}
      : { supplierReference: parsed.supplierReference }),
  };
}

function toCompositionJson(profile: ProductFabricProfileInput): Json {
  return profile.composition.map((component) => ({
    fibreConceptId: component.fibreConceptId,
    percentage: component.percentage,
  }));
}

/**
 * Fabric composition is replaced only through the atomic database RPC. Direct
 * Data API writes remain unavailable so a profile can never be observed with
 * a partial or non-100% composition.
 */
export class ProductFabricProfileRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  private async find(
    retailerId: RetailerId,
    productId: ProductId,
    productVariantId: ProductVariantId | null,
  ): Promise<ProductFabricProfile | null> {
    let query = this.client
      .from("product_fabric_profiles")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("product_id", productId)
      .is("deleted_at", null);

    query =
      productVariantId === null
        ? query.is("product_variant_id", null)
        : query.eq("product_variant_id", productVariantId);

    const { data: profile, error: profileError } = await query.maybeSingle();
    if (profileError) {
      throw profileError;
    }
    if (profile === null) {
      return null;
    }

    const { data: composition, error: compositionError } = await this.client
      .from("product_fabric_composition")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("profile_id", profile.id)
      .order("percentage", { ascending: false });

    if (compositionError) {
      throw compositionError;
    }
    return toDomain(profile, composition);
  }

  async findForProduct(
    retailerId: RetailerId,
    productId: ProductId,
  ): Promise<ProductFabricProfile | null> {
    return this.find(retailerId, productId, null);
  }

  async findForVariant(
    retailerId: RetailerId,
    productId: ProductId,
    productVariantId: ProductVariantId,
  ): Promise<ProductFabricProfile | null> {
    return this.find(retailerId, productId, productVariantId);
  }

  private async set(
    retailerId: RetailerId,
    productId: ProductId,
    productVariantId: ProductVariantId | null,
    input: ProductFabricProfileInput,
  ): Promise<ProductFabricProfile> {
    const profile = productFabricProfileSchema.parse(input);
    const { error } = await this.client.rpc("set_product_fabric_profile", {
      p_product_id: productId,
      p_composition: toCompositionJson(profile),
      ...(productVariantId === null
        ? {}
        : { p_product_variant_id: productVariantId }),
      ...(profile.fabricWeightGramsPerSquareMetre === undefined
        ? {}
        : {
            p_fabric_weight_grams_per_square_metre:
              profile.fabricWeightGramsPerSquareMetre,
          }),
      ...(profile.supplierReference === undefined
        ? {}
        : { p_supplier_reference: profile.supplierReference }),
    });

    if (error) {
      throw error;
    }

    const stored = await this.find(retailerId, productId, productVariantId);
    if (stored === null) {
      throw new Error("Stored fabric profile could not be reloaded");
    }
    return stored;
  }

  async setForProduct(
    retailerId: RetailerId,
    productId: ProductId,
    input: ProductFabricProfileInput,
  ): Promise<ProductFabricProfile> {
    return this.set(retailerId, productId, null, input);
  }

  async setForVariant(
    retailerId: RetailerId,
    productId: ProductId,
    productVariantId: ProductVariantId,
    input: ProductFabricProfileInput,
  ): Promise<ProductFabricProfile> {
    return this.set(retailerId, productId, productVariantId, input);
  }
}
