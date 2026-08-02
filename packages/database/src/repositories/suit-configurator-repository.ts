import {
  asId,
  type CustomerId,
  type RetailerId,
  type SuitConfigurationIntent,
  type SuitConfigurationLapel,
  type SuitConfigurationModelPreset,
  type SuitConfigurationPockets,
  type SuitConfigurationShoulder,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type IntentRow =
  Database["public"]["Tables"]["suit_configuration_intents"]["Row"];

function toDomain(row: IntentRow): SuitConfigurationIntent {
  return {
    id: asId<"SuitConfigurationIntentId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    lapel: row.lapel as SuitConfigurationLapel,
    pockets: row.pockets as SuitConfigurationPockets,
    shoulder: row.shoulder as SuitConfigurationShoulder,
    ...(row.model_preset
      ? { modelPreset: row.model_preset as SuitConfigurationModelPreset }
      : {}),
    createdAt: row.created_at,
  };
}

export class SuitConfiguratorRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findRecentByCustomer(
    customerId: CustomerId,
    limit = 10,
  ): Promise<SuitConfigurationIntent[]> {
    const { data, error } = await this.client
      .from("suit_configuration_intents")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toDomain);
  }

  async save(
    retailerId: RetailerId,
    values: {
      lapel: SuitConfigurationLapel;
      pockets: SuitConfigurationPockets;
      shoulder: SuitConfigurationShoulder;
      modelPreset?: SuitConfigurationModelPreset;
    },
  ): Promise<void> {
    const { error } = await this.client.rpc("save_suit_configuration_intent", {
      p_retailer_id: retailerId,
      p_lapel: values.lapel,
      p_pockets: values.pockets,
      p_shoulder: values.shoulder,
      ...(values.modelPreset ? { p_model_preset: values.modelPreset } : {}),
    });
    if (error) throw error;
  }
}
