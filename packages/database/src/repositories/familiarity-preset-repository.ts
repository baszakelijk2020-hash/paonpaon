import {
  FAMILIARITY_PRESETS,
  type FamiliarityPresetKey,
  type RetailerFamiliarityPreset,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PresetRow =
  Database["public"]["Tables"]["retailer_familiarity_presets"]["Row"];

const DEFAULT_PRESET: FamiliarityPresetKey = "paon_recommended";

function isFamiliarityPresetKey(value: string): value is FamiliarityPresetKey {
  return (FAMILIARITY_PRESETS as readonly string[]).includes(value);
}

function toPreset(row: PresetRow): RetailerFamiliarityPreset {
  const presetKey = isFamiliarityPresetKey(row.preset_key)
    ? row.preset_key
    : DEFAULT_PRESET;
  return {
    retailerId: row.retailer_id,
    presetKey,
    updatedAt: row.updated_at,
  };
}

export class FamiliarityPresetRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerFamiliarityPreset> {
    const { data, error } = await this.client
      .from("retailer_familiarity_presets")
      .select("*")
      .eq("retailer_id", retailerId)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return {
        retailerId,
        presetKey: DEFAULT_PRESET,
        updatedAt: new Date(0).toISOString(),
      };
    }

    return toPreset(data);
  }

  async upsertPreset(args: {
    readonly retailerId: RetailerId;
    readonly presetKey: FamiliarityPresetKey;
  }): Promise<RetailerFamiliarityPreset> {
    const { data, error } = await this.client
      .from("retailer_familiarity_presets")
      .upsert(
        {
          retailer_id: args.retailerId,
          preset_key: args.presetKey,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "retailer_id" },
      )
      .select("*")
      .single();

    if (error) throw error;
    return toPreset(data);
  }
}

export function resolveRetailerPresetKey(
  preset: RetailerFamiliarityPreset,
): FamiliarityPresetKey {
  return preset.presetKey;
}

export { DEFAULT_PRESET as DEFAULT_FAMILIARITY_PRESET };
