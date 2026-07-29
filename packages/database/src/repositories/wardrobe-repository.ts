/**
 * Wardrobe persistence: relationship-scoped items, append-only history,
 * and RPC-backed mutations (PHASE 4.1 / ADR-063).
 */

import {
  asId,
  type AddWardrobeAdvisorNoteSchemaInput,
  type CreateExternalWardrobeItemSchemaInput,
  type CreateRetailerPurchaseWardrobeItemSchemaInput,
  type CustomerId,
  type GarmentCategoryCode,
  type RetailerId,
  type UpdateWardrobeItemStateSchemaInput,
  type WardrobeConditionState,
  type WardrobeHistoryActorType,
  type WardrobeHistoryEventType,
  type WardrobeItem,
  type WardrobeItemId,
  type WardrobeItemState,
  type WardrobeOwnershipEvent,
  type WardrobeOwnershipSource,
  type WardrobeWearFrequency,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database, Json } from "../generated/database.types";

type WardrobeItemRow = Database["public"]["Tables"]["wardrobe_items"]["Row"];
type WardrobeEventRow =
  Database["public"]["Tables"]["wardrobe_ownership_events"]["Row"];

function toState(row: WardrobeItemRow): WardrobeItemState {
  return {
    conditionState: row.condition_state as WardrobeConditionState,
    ...(row.fit_notes ? { fitNotes: row.fit_notes } : {}),
    ...(row.care_notes ? { careNotes: row.care_notes } : {}),
    ...(row.wear_frequency
      ? { wearFrequency: row.wear_frequency as WardrobeWearFrequency }
      : {}),
    ...(row.last_worn_at ? { lastWornAt: row.last_worn_at } : {}),
  };
}

function toItem(row: WardrobeItemRow): WardrobeItem {
  return {
    id: asId<"WardrobeItemId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ownershipSource: row.ownership_source as WardrobeOwnershipSource,
    categoryCode: row.category_code as GarmentCategoryCode,
    title: row.title,
    ...(row.description ? { description: row.description } : {}),
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.photo_url ? { photoUrl: row.photo_url } : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
    ...(row.order_line_id
      ? { orderLineId: asId<"OrderLineId">(row.order_line_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
    state: toState(row),
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: WardrobeEventRow): WardrobeOwnershipEvent {
  const detail =
    row.detail && typeof row.detail === "object" && !Array.isArray(row.detail)
      ? (row.detail as Record<string, unknown>)
      : {};

  return {
    id: asId<"WardrobeOwnershipEventId">(row.id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    eventType: row.event_type as WardrobeHistoryEventType,
    actorType: row.actor_type as WardrobeHistoryActorType,
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    detail,
    createdAt: row.created_at,
  };
}

/** Wardrobe reads/writes for relationship-scoped ownership (ADR-063). */
export class WardrobeRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByCustomer(
    retailerId: RetailerId,
    customerId: CustomerId,
    options?: { readonly includeArchived?: boolean },
  ): Promise<WardrobeItem[]> {
    let query = this.client
      .from("wardrobe_items")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (!options?.includeArchived) {
      query = query.is("archived_at", null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.map(toItem);
  }

  async findById(itemId: WardrobeItemId): Promise<WardrobeItem | null> {
    const { data, error } = await this.client
      .from("wardrobe_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();
    if (error) throw error;
    return data ? toItem(data) : null;
  }

  async listHistory(
    itemId: WardrobeItemId,
    limit = 50,
  ): Promise<WardrobeOwnershipEvent[]> {
    const { data, error } = await this.client
      .from("wardrobe_ownership_events")
      .select("*")
      .eq("wardrobe_item_id", itemId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data.map(toEvent);
  }

  async createExternal(
    retailerId: RetailerId,
    input: CreateExternalWardrobeItemSchemaInput,
  ): Promise<WardrobeItem> {
    const { data, error } = await this.client.rpc(
      "create_external_wardrobe_item",
      {
        p_retailer_id: retailerId,
        p_category_code: input.categoryCode,
        p_title: input.title,
        p_condition_state: input.conditionState ?? "good",
        ...(input.description ? { p_description: input.description } : {}),
        ...(input.brand ? { p_brand: input.brand } : {}),
        ...(input.photoUrl ? { p_photo_url: input.photoUrl } : {}),
        ...(input.fitNotes ? { p_fit_notes: input.fitNotes } : {}),
        ...(input.careNotes ? { p_care_notes: input.careNotes } : {}),
        ...(input.wearFrequency
          ? { p_wear_frequency: input.wearFrequency }
          : {}),
      },
    );
    if (error) throw error;
    return toItem(data);
  }

  async createRetailerPurchase(
    customerId: CustomerId,
    input: CreateRetailerPurchaseWardrobeItemSchemaInput,
  ): Promise<WardrobeItem> {
    const { data, error } = await this.client.rpc(
      "create_retailer_purchase_wardrobe_item",
      {
        p_customer_id: customerId,
        p_category_code: input.categoryCode,
        p_title: input.title,
        p_condition_state: input.conditionState ?? "good",
        ...(input.description ? { p_description: input.description } : {}),
        ...(input.brand ? { p_brand: input.brand } : {}),
        ...(input.photoUrl ? { p_photo_url: input.photoUrl } : {}),
        ...(input.productId ? { p_product_id: input.productId } : {}),
        ...(input.orderLineId ? { p_order_line_id: input.orderLineId } : {}),
        ...(input.physicalGarmentId
          ? { p_physical_garment_id: input.physicalGarmentId }
          : {}),
        ...(input.fitNotes ? { p_fit_notes: input.fitNotes } : {}),
        ...(input.careNotes ? { p_care_notes: input.careNotes } : {}),
        ...(input.wearFrequency
          ? { p_wear_frequency: input.wearFrequency }
          : {}),
      },
    );
    if (error) throw error;
    return toItem(data);
  }

  async updateState(
    itemId: WardrobeItemId,
    input: UpdateWardrobeItemStateSchemaInput,
  ): Promise<WardrobeItem> {
    const { data, error } = await this.client.rpc(
      "update_wardrobe_item_state",
      {
        p_wardrobe_item_id: itemId,
        ...(input.conditionState
          ? { p_condition_state: input.conditionState }
          : {}),
        ...(input.fitNotes !== undefined
          ? { p_fit_notes: input.fitNotes }
          : {}),
        ...(input.careNotes !== undefined
          ? { p_care_notes: input.careNotes }
          : {}),
        ...(input.wearFrequency
          ? { p_wear_frequency: input.wearFrequency }
          : {}),
        ...(input.lastWornAt ? { p_last_worn_at: input.lastWornAt } : {}),
      },
    );
    if (error) throw error;
    return toItem(data);
  }

  async addAdvisorNote(
    itemId: WardrobeItemId,
    input: AddWardrobeAdvisorNoteSchemaInput,
  ): Promise<WardrobeOwnershipEvent> {
    const { data, error } = await this.client.rpc("add_wardrobe_advisor_note", {
      p_wardrobe_item_id: itemId,
      p_note: input.note,
    });
    if (error) throw error;
    return toEvent(data);
  }

  async archive(itemId: WardrobeItemId): Promise<WardrobeItem> {
    const { data, error } = await this.client.rpc("archive_wardrobe_item", {
      p_wardrobe_item_id: itemId,
    });
    if (error) throw error;
    return toItem(data);
  }
}

export function wardrobeItemCountByCustomer(
  items: readonly WardrobeItem[],
): number {
  return items.filter((item) => item.archivedAt === undefined).length;
}

/** Test helper — maps JSON detail from RPC payloads. */
export function parseWardrobeEventDetail(value: Json): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}
