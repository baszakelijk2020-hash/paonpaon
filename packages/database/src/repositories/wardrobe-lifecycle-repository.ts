/**
 * Wardrobe lifecycle events and guidance dismissals (PHASE 4.3).
 */

import {
  asId,
  deriveWardrobeGuidance,
  projectFitFreshness,
  type CustomerId,
  type DismissWardrobeGuidanceInput,
  type FitFreshnessProjection,
  type LogWardrobeLifecycleEventInput,
  type WardrobeGuidanceDismissalId,
  type WardrobeGuidanceItem,
  type WardrobeItem,
  type WardrobeItemId,
  type WardrobeLifecycleEvent,
  type WardrobeLifecycleEventKind,
  type WardrobeLifecycleEventId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type LifecycleEventRow =
  Database["public"]["Tables"]["wardrobe_lifecycle_events"]["Row"];

function toLifecycleEvent(row: LifecycleEventRow): WardrobeLifecycleEvent {
  return {
    id: asId<"WardrobeLifecycleEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    eventKind: row.event_kind as WardrobeLifecycleEventKind,
    ...(row.note ? { note: row.note } : {}),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export interface WardrobeItemServiceView {
  readonly item: WardrobeItem;
  readonly lifecycleEvents: readonly WardrobeLifecycleEvent[];
  readonly guidance: readonly WardrobeGuidanceItem[];
  readonly fitFreshness: FitFreshnessProjection;
}

export class WardrobeLifecycleRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async listLifecycleEvents(
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeLifecycleEvent[]> {
    const { data, error } = await this.client
      .from("wardrobe_lifecycle_events")
      .select("*")
      .eq("wardrobe_item_id", wardrobeItemId)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return data.map(toLifecycleEvent);
  }

  async listDismissedKeys(
    customerId: CustomerId,
  ): Promise<ReadonlySet<string>> {
    const { data, error } = await this.client
      .from("wardrobe_guidance_dismissals")
      .select("guidance_key")
      .eq("customer_id", customerId);
    if (error) throw error;
    return new Set(data.map((row) => row.guidance_key));
  }

  async logLifecycleEvent(
    input: LogWardrobeLifecycleEventInput,
  ): Promise<WardrobeLifecycleEventId> {
    const { data, error } = await this.client.rpc(
      "record_wardrobe_lifecycle_event",
      {
        p_wardrobe_item_id: input.wardrobeItemId,
        p_event_kind: input.eventKind,
        ...(input.note ? { p_note: input.note } : {}),
        ...(input.occurredAt ? { p_occurred_at: input.occurredAt } : {}),
      },
    );
    if (error) throw error;
    return asId<"WardrobeLifecycleEventId">(data as string);
  }

  async dismissGuidance(
    input: DismissWardrobeGuidanceInput,
  ): Promise<WardrobeGuidanceDismissalId> {
    const { data, error } = await this.client.rpc("dismiss_wardrobe_guidance", {
      p_wardrobe_item_id: input.wardrobeItemId,
      p_guidance_key: input.guidanceKey,
    });
    if (error) throw error;
    return asId<"WardrobeGuidanceDismissalId">(data as string);
  }

  async latestOfficialFittingAt(
    wardrobeItemId: WardrobeItemId,
  ): Promise<string | null> {
    const { data, error } = await this.client.rpc(
      "latest_official_fitting_at",
      {
        p_wardrobe_item_id: wardrobeItemId,
      },
    );
    if (error) throw error;
    return typeof data === "string" ? data : null;
  }

  async buildServiceView(params: {
    readonly item: WardrobeItem;
    readonly now?: string;
  }): Promise<WardrobeItemServiceView> {
    const now = params.now ?? new Date().toISOString();
    const [lifecycleEvents, dismissedKeys, lastOfficial] = await Promise.all([
      this.listLifecycleEvents(params.item.id),
      this.listDismissedKeys(params.item.customerId),
      this.latestOfficialFittingAt(params.item.id),
    ]);

    return {
      item: params.item,
      lifecycleEvents,
      guidance: deriveWardrobeGuidance({
        item: params.item,
        lifecycleEvents,
        dismissedKeys,
        now,
      }),
      fitFreshness: projectFitFreshness({
        lastOfficialMeasuredAt: lastOfficial,
        now,
      }),
    };
  }
}
