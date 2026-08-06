/**
 * StylePortrait persistence (VWS-001 / PHASE 4.6 / ADR-074). Status
 * transitions go through plain RLS-governed updates — unlike silhouette
 * analysis, a style portrait has no advisor-approval gate in this slice;
 * the customer owns their own preview/approve/reject loop end to end.
 */

import {
  asId,
  type CreateStylePortraitInput,
  type CustomerId,
  type StylePortrait,
  type StylePortraitId,
  type StylePortraitReference,
  type StylePortraitReferenceKind,
  type StylePortraitStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PortraitRow = Database["public"]["Tables"]["style_portraits"]["Row"];
type ReferenceRow =
  Database["public"]["Tables"]["style_portrait_references"]["Row"];

function toReference(row: ReferenceRow): StylePortraitReference {
  return {
    id: asId<"StylePortraitReferenceId">(row.id),
    stylePortraitId: asId<"StylePortraitId">(row.style_portrait_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    kind: row.kind as StylePortraitReferenceKind,
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

function toPortrait(
  row: PortraitRow,
  references: readonly StylePortraitReference[],
): StylePortrait {
  return {
    id: asId<"StylePortraitId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    version: row.version,
    status: row.status as StylePortraitStatus,
    ...(row.fit_archetype_concept_id
      ? { fitArchetypeConceptId: row.fit_archetype_concept_id }
      : {}),
    ...(row.preview_image_url
      ? { previewImageUrl: row.preview_image_url }
      : {}),
    ...(row.approved_at ? { approvedAt: row.approved_at } : {}),
    ...(row.superseded_at ? { supersededAt: row.superseded_at } : {}),
    ...(row.rejected_reason ? { rejectedReason: row.rejected_reason } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    references,
  };
}

export class StylePortraitRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async create(input: CreateStylePortraitInput): Promise<StylePortrait> {
    const { data, error } = await this.client
      .from("style_portraits")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        fit_archetype_concept_id: input.fitArchetypeConceptId ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;

    const referenceRows = input.references.map((reference) => ({
      style_portrait_id: data.id,
      retailer_id: input.retailerId as string,
      kind: reference.kind,
      storage_bucket: reference.storageBucket,
      storage_path: reference.storagePath,
    }));

    const { data: insertedReferences, error: referenceError } =
      await this.client
        .from("style_portrait_references")
        .insert(referenceRows)
        .select("*");
    if (referenceError) throw referenceError;

    return toPortrait(data, insertedReferences.map(toReference));
  }

  async findById(id: StylePortraitId): Promise<StylePortrait | null> {
    const { data, error } = await this.client
      .from("style_portraits")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toPortrait(data, await this.listReferences(id));
  }

  async findApprovedForCustomer(
    customerId: CustomerId,
  ): Promise<StylePortrait | null> {
    const { data, error } = await this.client
      .from("style_portraits")
      .select("*")
      .eq("customer_id", customerId)
      .eq("status", "approved")
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toPortrait(
      data,
      await this.listReferences(asId<"StylePortraitId">(data.id)),
    );
  }

  async findLatestForCustomer(
    customerId: CustomerId,
  ): Promise<StylePortrait | null> {
    const { data, error } = await this.client
      .from("style_portraits")
      .select("*")
      .eq("customer_id", customerId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return toPortrait(
      data,
      await this.listReferences(asId<"StylePortraitId">(data.id)),
    );
  }

  async recordPreview(
    id: StylePortraitId,
    previewImageUrl: string,
  ): Promise<StylePortrait> {
    const { data, error } = await this.client
      .from("style_portraits")
      .update({
        status: "preview_generated",
        preview_image_url: previewImageUrl,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toPortrait(data, await this.listReferences(id));
  }

  async approve(id: StylePortraitId): Promise<StylePortrait> {
    const { data, error } = await this.client
      .from("style_portraits")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toPortrait(data, await this.listReferences(id));
  }

  async reject(id: StylePortraitId, reason: string): Promise<StylePortrait> {
    const { data, error } = await this.client
      .from("style_portraits")
      .update({ status: "rejected", rejected_reason: reason })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toPortrait(data, await this.listReferences(id));
  }

  async supersede(id: StylePortraitId): Promise<StylePortrait> {
    const { data, error } = await this.client
      .from("style_portraits")
      .update({ status: "superseded", superseded_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return toPortrait(data, await this.listReferences(id));
  }

  private async listReferences(
    stylePortraitId: StylePortraitId,
  ): Promise<StylePortraitReference[]> {
    const { data, error } = await this.client
      .from("style_portrait_references")
      .select("*")
      .eq("style_portrait_id", stylePortraitId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(toReference);
  }
}
