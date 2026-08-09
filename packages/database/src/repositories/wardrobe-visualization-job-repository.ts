/**
 * WardrobeVisualizationJob persistence (VWS-001 / PHASE 4.6 / ADR-074).
 * Every write goes through the narrow RPCs in migration `20260806100000`/
 * `20260806120000` — this repository never inserts/updates the job row
 * directly, same discipline as `SilhouetteAnalysisRepository`. A ready
 * job's image lives in the private `wardrobe-studio` bucket
 * (`output_storage_bucket`/`output_storage_path`), never a bare provider
 * URL; `toJob` signs it on read, same pattern as
 * `SilhouetteAnalysisRepository.findCapturesForSessionWithUrls`. The
 * sha256 digest uses the Web Crypto `SubtleCrypto` API (available in
 * Node, Edge and the browser) rather than `node:crypto` — this package is
 * bundled into the Next.js apps' webpack graph via `@paon/database`'s
 * index, which cannot resolve a `node:`-scheme import.
 */

import {
  asId,
  canonicalizeWardrobeVisualizationInput,
  type CustomerId,
  type EnqueueStylePortraitPreviewJobInput,
  type EnqueueWardrobeVisualizationJobInput,
  type OutfitId,
  type StylePortraitId,
  type StylePortraitPreviewInputSnapshot,
  type WardrobeVisualizationInputSnapshot,
  type WardrobeVisualizationJob,
  type WardrobeVisualizationJobId,
  type WardrobeVisualizationJobStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type JobRow =
  Database["public"]["Tables"]["wardrobe_visualization_jobs"]["Row"];

const SIGNED_URL_TTL_SECONDS = 15 * 60;

export async function hashWardrobeVisualizationInput(
  input: WardrobeVisualizationInputSnapshot,
): Promise<string> {
  const bytes = new TextEncoder().encode(
    canonicalizeWardrobeVisualizationInput(input),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function parseInputSnapshot(value: Json): WardrobeVisualizationInputSnapshot {
  return value as unknown as WardrobeVisualizationInputSnapshot;
}

async function toJob(
  client: PaonSupabaseClient,
  row: JobRow,
): Promise<WardrobeVisualizationJob> {
  let outputImageUrl: string | undefined;
  if (row.output_storage_bucket && row.output_storage_path) {
    const { data: signed, error } = await client.storage
      .from(row.output_storage_bucket)
      .createSignedUrl(row.output_storage_path, SIGNED_URL_TTL_SECONDS);
    if (error) throw error;
    outputImageUrl = signed.signedUrl;
  }

  return {
    id: asId<"WardrobeVisualizationJobId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    kind: row.job_kind as WardrobeVisualizationJob["kind"],
    ...(row.outfit_id ? { outfitId: asId<"OutfitId">(row.outfit_id) } : {}),
    stylePortraitId: asId<"StylePortraitId">(row.style_portrait_id),
    retailerVisualPresetId: asId<"RetailerVisualPresetId">(
      row.retailer_visual_preset_id,
    ),
    providerName: row.provider,
    model: row.model,
    inputSnapshot: parseInputSnapshot(row.input_snapshot),
    inputHash: row.input_hash,
    status: row.status as WardrobeVisualizationJobStatus,
    attempt: row.attempt,
    ...(outputImageUrl ? { outputImageUrl } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    ...(row.estimated_cost_cents !== null
      ? { estimatedCostCents: row.estimated_cost_cents }
      : {}),
    ...(row.actual_cost_cents !== null
      ? { actualCostCents: row.actual_cost_cents }
      : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class WardrobeVisualizationJobRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  /** Re-derives caller identity server-side (owning customer or an
   * authorized advisor in the same relationship); duplicate active jobs
   * for the same outfit + exact input are deduped by the RPC itself. */
  async enqueue(
    input: EnqueueWardrobeVisualizationJobInput,
    snapshot: WardrobeVisualizationInputSnapshot,
  ): Promise<WardrobeVisualizationJob> {
    const inputHash = await hashWardrobeVisualizationInput(snapshot);

    const { data, error } = await this.client.rpc(
      "enqueue_wardrobe_visualization_job",
      {
        p_retailer_id: input.retailerId,
        p_customer_id: input.customerId,
        p_outfit_id: input.outfitId,
        p_style_portrait_id: input.stylePortraitId,
        p_retailer_visual_preset_id: input.retailerVisualPresetId,
        p_provider: snapshot.providerName,
        p_model: snapshot.model,
        p_input_snapshot: snapshot as unknown as Json,
        p_input_hash: inputHash,
      },
    );
    if (error) throw error;
    return toJob(this.client, data);
  }

  /** Customer-only onboarding preview enqueue. The RPC re-derives module,
   * consent, reference, fit and tenant gates in the insert transaction. */
  async enqueueStylePortraitPreview(
    input: EnqueueStylePortraitPreviewJobInput,
    snapshot: StylePortraitPreviewInputSnapshot,
  ): Promise<WardrobeVisualizationJob> {
    const inputHash = await hashWardrobeVisualizationInput(snapshot);
    const { data, error } = await this.client.rpc(
      "enqueue_style_portrait_preview_job",
      {
        p_retailer_id: input.retailerId,
        p_customer_id: input.customerId,
        p_style_portrait_id: input.stylePortraitId,
        p_retailer_visual_preset_id: input.retailerVisualPresetId,
        p_provider: snapshot.providerName,
        p_model: snapshot.model,
        p_input_snapshot: snapshot as unknown as Json,
        p_input_hash: inputHash,
      },
    );
    if (error) throw error;
    return toJob(this.client, data);
  }

  async cancel(jobId: WardrobeVisualizationJobId): Promise<void> {
    const { error } = await this.client.rpc(
      "cancel_wardrobe_visualization_job",
      {
        p_job_id: jobId,
      },
    );
    if (error) throw error;
  }

  /** service_role only — the queue runner claims a batch to process
   * sequentially. `for update skip locked` makes concurrent workers safe. */
  async claimPending(limit = 5): Promise<WardrobeVisualizationJob[]> {
    const { data, error } = await this.client.rpc(
      "claim_pending_wardrobe_visualization_jobs",
      { p_limit: limit },
    );
    if (error) throw error;
    return Promise.all((data ?? []).map((row) => toJob(this.client, row)));
  }

  /** service_role only — the runner reports the terminal result. The
   * output image must already be uploaded into `wardrobe-studio` before
   * this is called; only its storage location is ever recorded, never a
   * raw provider URL. */
  async complete(params: {
    readonly jobId: WardrobeVisualizationJobId;
    readonly status: "ready" | "failed";
    readonly outputStorageBucket?: string;
    readonly outputStoragePath?: string;
    readonly errorMessage?: string;
    readonly actualCostCents?: number;
  }): Promise<WardrobeVisualizationJob> {
    const { data, error } = await this.client.rpc(
      "complete_wardrobe_visualization_job",
      {
        p_job_id: params.jobId,
        p_status: params.status,
        ...(params.outputStorageBucket !== undefined
          ? { p_output_storage_bucket: params.outputStorageBucket }
          : {}),
        ...(params.outputStoragePath !== undefined
          ? { p_output_storage_path: params.outputStoragePath }
          : {}),
        ...(params.errorMessage !== undefined
          ? { p_error_message: params.errorMessage }
          : {}),
        ...(params.actualCostCents !== undefined
          ? { p_actual_cost_cents: params.actualCostCents }
          : {}),
      },
    );
    if (error) throw error;
    return toJob(this.client, data);
  }

  async findById(
    id: WardrobeVisualizationJobId,
  ): Promise<WardrobeVisualizationJob | null> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? await toJob(this.client, data) : null;
  }

  async findByOutfit(outfitId: OutfitId): Promise<WardrobeVisualizationJob[]> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_jobs")
      .select("*")
      .eq("outfit_id", outfitId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all(data.map((row) => toJob(this.client, row)));
  }

  async findLatestStylePortraitPreview(
    stylePortraitId: StylePortraitId,
  ): Promise<WardrobeVisualizationJob | null> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_jobs")
      .select("*")
      .eq("style_portrait_id", stylePortraitId)
      .eq("job_kind", "style_portrait_preview")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? await toJob(this.client, data) : null;
  }

  async findByCustomer(
    customerId: CustomerId,
  ): Promise<WardrobeVisualizationJob[]> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_jobs")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all(data.map((row) => toJob(this.client, row)));
  }
}
