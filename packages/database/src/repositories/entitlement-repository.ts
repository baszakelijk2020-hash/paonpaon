import { type CommercialFeatureKey, type RetailerId } from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";

/**
 * Server-enforced commercial access. UI navigation may use this result for
 * presentation, but authorization must call the database function again at
 * the protected server boundary rather than trusting a client-side flag.
 */
export class EntitlementRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async retailerHas(
    retailerId: RetailerId,
    featureKey: CommercialFeatureKey,
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc("retailer_has_entitlement", {
      p_retailer_id: retailerId,
      p_feature_key: featureKey,
    });
    if (error) throw error;
    return data;
  }
}
