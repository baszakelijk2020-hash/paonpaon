import {
  asId,
  checkDecideConceptAsset,
  type CorporateConceptAsset,
  type CorporateConceptAssetId,
  type CorporateConceptAssetStatus,
  type CorporateTenderVersionId,
  type RetailerId,
  type StaffId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type ConceptAssetRow =
  Database["public"]["Tables"]["corporate_concept_assets"]["Row"];

function toConceptAsset(row: ConceptAssetRow): CorporateConceptAsset {
  return {
    id: asId<"CorporateConceptAssetId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    tenderVersionId: asId<"CorporateTenderVersionId">(row.tender_version_id),
    aiGenerationId: row.ai_generation_id,
    imageUrl: row.image_url,
    prompt: row.prompt,
    status: row.status as CorporateConceptAssetStatus,
    ...(row.approved_by_staff_id
      ? { approvedByStaffId: asId<"StaffId">(row.approved_by_staff_id) }
      : {}),
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    createdAt: row.created_at,
  };
}

export type DecideConceptAssetResult =
  | { readonly ok: true; readonly asset: CorporateConceptAsset }
  | { readonly ok: false; readonly reason: "already_decided" }
  | { readonly ok: false; readonly reason: "asset_not_found" };

/**
 * Corporate tender concept/moodboard images (PHASE 18.10 / BD-110). An
 * asset always references a real `ai_generations` row (the generation
 * attempt it came from) and starts `pending_approval` — `decide` is the
 * only write path that can move it to `approved`/`rejected`, exactly
 * once.
 */
export class CorporateConceptAssetRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listByTenderVersion(
    tenderVersionId: CorporateTenderVersionId,
  ): Promise<readonly CorporateConceptAsset[]> {
    const { data, error } = await this.client
      .from("corporate_concept_assets")
      .select("*")
      .eq("tender_version_id", tenderVersionId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toConceptAsset);
  }

  async findById(
    assetId: CorporateConceptAssetId,
  ): Promise<CorporateConceptAsset | null> {
    const { data, error } = await this.client
      .from("corporate_concept_assets")
      .select("*")
      .eq("id", assetId)
      .maybeSingle();
    if (error) throw error;
    return data ? toConceptAsset(data) : null;
  }

  async create(args: {
    readonly retailerId: RetailerId;
    readonly tenderVersionId: CorporateTenderVersionId;
    readonly aiGenerationId: string;
    readonly imageUrl: string;
    readonly prompt: string;
  }): Promise<CorporateConceptAsset> {
    const { data, error } = await this.client
      .from("corporate_concept_assets")
      .insert({
        retailer_id: args.retailerId,
        tender_version_id: args.tenderVersionId,
        ai_generation_id: args.aiGenerationId,
        image_url: args.imageUrl,
        prompt: args.prompt,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toConceptAsset(data);
  }

  async decide(args: {
    readonly assetId: CorporateConceptAssetId;
    readonly decision: "approved" | "rejected";
    readonly staffId: StaffId;
  }): Promise<DecideConceptAssetResult> {
    const current = await this.findById(args.assetId);
    if (!current) return { ok: false, reason: "asset_not_found" };
    const check = checkDecideConceptAsset({ status: current.status });
    if (!check.ok) return check;

    const { data, error } = await this.client
      .from("corporate_concept_assets")
      .update({
        status: args.decision,
        ...(args.decision === "approved"
          ? {
              approved_by_staff_id: args.staffId,
              approved_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", args.assetId)
      .select("*")
      .single();
    if (error) throw error;
    return { ok: true, asset: toConceptAsset(data) };
  }
}
