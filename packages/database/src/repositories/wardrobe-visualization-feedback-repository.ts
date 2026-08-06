/**
 * WardrobeVisualizationFeedback persistence (VWS-001 / PHASE 4.6 /
 * ADR-074). A single-table, tenant-scoped insert — same "direct RLS, no
 * security-definer RPC" reasoning ADR-028 gave `customer_preferences` and
 * `ai_generations`.
 */

import {
  asId,
  type CustomerId,
  type RecordWardrobeVisualizationFeedbackInput,
  type WardrobeVisualizationFeedback,
  type WardrobeVisualizationFeedbackSignal,
  type WardrobeVisualizationJobId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type FeedbackRow =
  Database["public"]["Tables"]["wardrobe_visualization_feedback"]["Row"];

function toFeedback(row: FeedbackRow): WardrobeVisualizationFeedback {
  return {
    id: asId<"WardrobeVisualizationFeedbackId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    jobId: asId<"WardrobeVisualizationJobId">(row.job_id),
    signal: row.signal as WardrobeVisualizationFeedbackSignal,
    ...(row.note ? { note: row.note } : {}),
    createdAt: row.created_at,
  };
}

export class WardrobeVisualizationFeedbackRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async record(
    input: RecordWardrobeVisualizationFeedbackInput,
  ): Promise<WardrobeVisualizationFeedback> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_feedback")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        job_id: input.jobId,
        signal: input.signal,
        note: input.note ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toFeedback(data);
  }

  async findByJob(
    jobId: WardrobeVisualizationJobId,
  ): Promise<WardrobeVisualizationFeedback[]> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_feedback")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toFeedback);
  }

  async findByCustomer(
    customerId: CustomerId,
  ): Promise<WardrobeVisualizationFeedback[]> {
    const { data, error } = await this.client
      .from("wardrobe_visualization_feedback")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toFeedback);
  }
}
