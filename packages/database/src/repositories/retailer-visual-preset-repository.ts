/**
 * RetailerVisualPreset persistence (VWS-001 / PHASE 4.6 / ADR-074). Routine
 * customer/advisor generation always uses the retailer default preset
 * automatically — `findDefaultForRetailer` is the hot path.
 */

import {
  asId,
  type CreateRetailerVisualPresetInput,
  type RetailerId,
  type RetailerVisualPreset,
  type RetailerVisualPresetId,
  type VisualPresetBackgroundType,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PresetRow = Database["public"]["Tables"]["retailer_visual_presets"]["Row"];

function toPreset(row: PresetRow): RetailerVisualPreset {
  return {
    id: asId<"RetailerVisualPresetId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    name: row.name,
    isDefault: row.is_default,
    backgroundType: row.background_type as VisualPresetBackgroundType,
    ...(row.background_image_url
      ? { backgroundImageUrl: row.background_image_url }
      : {}),
    poseFamily: row.pose_family,
    cameraHeight: row.camera_height,
    cameraDistance: row.camera_distance,
    crop: row.crop,
    aspectRatio: row.aspect_ratio,
    lighting: row.lighting,
    expression: row.expression,
    visualTreatment: row.visual_treatment,
    negativeConstraints: (row.negative_constraints as string[] | null) ?? [],
    bodyModificationProhibited: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RetailerVisualPresetRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async create(
    input: CreateRetailerVisualPresetInput,
  ): Promise<RetailerVisualPreset> {
    const { data, error } = await this.client
      .from("retailer_visual_presets")
      .insert({
        retailer_id: input.retailerId,
        name: input.name,
        is_default: input.isDefault,
        background_type: input.backgroundType,
        background_image_url: input.backgroundImageUrl ?? null,
        pose_family: input.poseFamily,
        camera_height: input.cameraHeight,
        camera_distance: input.cameraDistance,
        crop: input.crop,
        aspect_ratio: input.aspectRatio,
        lighting: input.lighting,
        expression: input.expression,
        visual_treatment: input.visualTreatment,
        negative_constraints: input.negativeConstraints,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toPreset(data);
  }

  async findById(
    id: RetailerVisualPresetId,
  ): Promise<RetailerVisualPreset | null> {
    const { data, error } = await this.client
      .from("retailer_visual_presets")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toPreset(data) : null;
  }

  async findDefaultForRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerVisualPreset | null> {
    const { data, error } = await this.client
      .from("retailer_visual_presets")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("is_default", true)
      .maybeSingle();
    if (error) throw error;
    return data ? toPreset(data) : null;
  }

  async listForRetailer(
    retailerId: RetailerId,
  ): Promise<RetailerVisualPreset[]> {
    const { data, error } = await this.client
      .from("retailer_visual_presets")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toPreset);
  }
}
