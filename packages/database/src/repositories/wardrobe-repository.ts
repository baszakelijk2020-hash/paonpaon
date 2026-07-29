/**
 * Relationship-scoped wardrobe persistence (PHASE 4.1 / ADR-063).
 * PhysicalGarment remains the official fitting/service aggregate.
 */

import {
  asId,
  isWardrobeItemConsistent,
  type CreateAdvisorExternalWardrobeItemInput,
  type CreateCatalogueWardrobeItemInput,
  type CreateExternalWardrobeItemInput,
  type CustomerId,
  type GarmentCategoryCode,
  type RetailerId,
  type StaffId,
  type UpdateWardrobeItemStateInput,
  type WardrobeActorKind,
  type WardrobeCareState,
  type WardrobeConditionState,
  type WardrobeFitPerception,
  type WardrobeItem,
  type WardrobeItemId,
  type WardrobeOwnershipEvent,
  type WardrobeOwnershipEventKind,
  type WardrobeOwnershipKind,
  type WardrobeProvenanceSource,
  type WardrobeWearFrequency,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type WardrobeItemRow = Database["public"]["Tables"]["wardrobe_items"]["Row"];
type WardrobeOwnershipEventRow =
  Database["public"]["Tables"]["wardrobe_ownership_events"]["Row"];

function toItem(row: WardrobeItemRow): WardrobeItem {
  return {
    id: asId<"WardrobeItemId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ownershipKind: row.ownership_kind as WardrobeOwnershipKind,
    provenanceSource: row.provenance_source as WardrobeProvenanceSource,
    categoryCode: row.category_code as GarmentCategoryCode,
    displayName: row.display_name,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.description ? { description: row.description } : {}),
    condition: row.condition as WardrobeConditionState,
    ...(row.wear_frequency
      ? { wearFrequency: row.wear_frequency as WardrobeWearFrequency }
      : {}),
    careState: row.care_state as WardrobeCareState,
    fitPerception: row.fit_perception as WardrobeFitPerception,
    ...(row.care_notes ? { careNotes: row.care_notes } : {}),
    ...(row.fit_notes ? { fitNotes: row.fit_notes } : {}),
    ...(row.acquired_at ? { acquiredAt: row.acquired_at } : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
    ...(row.order_line_id
      ? { orderLineId: asId<"OrderLineId">(row.order_line_id) }
      : {}),
    ...(row.physical_garment_id
      ? {
          physicalGarmentId: asId<"PhysicalGarmentId">(row.physical_garment_id),
        }
      : {}),
    ...(row.identifying_photo_url
      ? { identifyingPhotoUrl: row.identifying_photo_url }
      : {}),
    createdByActor: row.created_by_actor as Exclude<
      WardrobeActorKind,
      "system"
    >,
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    ...(row.retired_at ? { retiredAt: row.retired_at } : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: WardrobeOwnershipEventRow): WardrobeOwnershipEvent {
  return {
    id: asId<"WardrobeOwnershipEventId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id),
    eventKind: row.event_kind as WardrobeOwnershipEventKind,
    ownershipKind: row.ownership_kind as WardrobeOwnershipKind,
    provenanceSource: row.provenance_source as WardrobeProvenanceSource,
    actorKind: row.actor_kind as WardrobeActorKind,
    ...(row.actor_staff_id
      ? { actorStaffId: asId<"StaffId">(row.actor_staff_id) }
      : {}),
    ...(row.note ? { note: row.note } : {}),
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export class WardrobeRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: WardrobeItemId): Promise<WardrobeItem | null> {
    const { data, error } = await this.client
      .from("wardrobe_items")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    return data ? toItem(data) : null;
  }

  async findByCustomer(customerId: CustomerId): Promise<WardrobeItem[]> {
    const { data, error } = await this.client
      .from("wardrobe_items")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(toItem);
  }

  async listOwnershipHistory(
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeOwnershipEvent[]> {
    const { data, error } = await this.client
      .from("wardrobe_ownership_events")
      .select("*")
      .eq("wardrobe_item_id", wardrobeItemId)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return data.map(toEvent);
  }

  async createExternalItem(
    input: CreateExternalWardrobeItemInput,
  ): Promise<WardrobeItem> {
    if (
      !isWardrobeItemConsistent({
        ownershipKind: "external",
        provenanceSource: "customer_added",
        orderLineId: null,
        productId: input.productId ?? null,
        createdByActor: "customer",
        createdByStaffId: null,
        retiredAt: null,
        condition: input.condition,
      })
    ) {
      throw new Error("External wardrobe item failed ownership rules.");
    }

    const { data, error } = await this.client
      .from("wardrobe_items")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        ownership_kind: "external",
        provenance_source: "customer_added",
        category_code: input.categoryCode,
        display_name: input.displayName,
        brand: input.brand ?? null,
        description: input.description ?? null,
        condition: input.condition,
        wear_frequency: input.wearFrequency ?? null,
        care_state: input.careState,
        fit_perception: input.fitPerception,
        care_notes: input.careNotes ?? null,
        fit_notes: input.fitNotes ?? null,
        acquired_at: input.acquiredAt ?? null,
        product_id: input.productId ?? null,
        identifying_photo_url: input.identifyingPhotoUrl ?? null,
        created_by_actor: "customer",
        created_by_staff_id: null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toItem(data);
  }

  async createCatalogueItem(
    input: CreateCatalogueWardrobeItemInput,
    createdByStaffId: StaffId,
  ): Promise<WardrobeItem> {
    const provenanceSource = input.orderLineId
      ? "order_line"
      : "catalogue_link";
    if (
      !isWardrobeItemConsistent({
        ownershipKind: "retailer_purchased",
        provenanceSource,
        orderLineId: input.orderLineId ?? null,
        productId: input.productId,
        physicalGarmentId: input.physicalGarmentId ?? null,
        createdByActor: "advisor",
        createdByStaffId,
        retiredAt: null,
        condition: input.condition,
      })
    ) {
      throw new Error("Catalogue wardrobe item failed ownership rules.");
    }

    const { data, error } = await this.client
      .from("wardrobe_items")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        ownership_kind: "retailer_purchased",
        provenance_source: provenanceSource,
        category_code: input.categoryCode,
        display_name: input.displayName,
        brand: input.brand ?? null,
        description: input.description ?? null,
        condition: input.condition,
        wear_frequency: input.wearFrequency ?? null,
        care_state: input.careState,
        fit_perception: input.fitPerception,
        care_notes: input.careNotes ?? null,
        fit_notes: input.fitNotes ?? null,
        acquired_at: input.acquiredAt ?? null,
        product_id: input.productId,
        order_line_id: input.orderLineId ?? null,
        physical_garment_id: input.physicalGarmentId ?? null,
        identifying_photo_url: input.identifyingPhotoUrl ?? null,
        created_by_actor: "advisor",
        created_by_staff_id: createdByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toItem(data);
  }

  async createAdvisorExternalItem(
    input: CreateAdvisorExternalWardrobeItemInput,
    createdByStaffId: StaffId,
  ): Promise<WardrobeItem> {
    if (
      !isWardrobeItemConsistent({
        ownershipKind: "external",
        provenanceSource: "advisor_added",
        orderLineId: null,
        productId: input.productId ?? null,
        physicalGarmentId: input.physicalGarmentId ?? null,
        createdByActor: "advisor",
        createdByStaffId,
        retiredAt: null,
        condition: input.condition,
      })
    ) {
      throw new Error("Advisor external wardrobe item failed ownership rules.");
    }

    const { data, error } = await this.client
      .from("wardrobe_items")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        ownership_kind: "external",
        provenance_source: "advisor_added",
        category_code: input.categoryCode,
        display_name: input.displayName,
        brand: input.brand ?? null,
        description: input.description ?? null,
        condition: input.condition,
        wear_frequency: input.wearFrequency ?? null,
        care_state: input.careState,
        fit_perception: input.fitPerception,
        care_notes: input.careNotes ?? null,
        fit_notes: input.fitNotes ?? null,
        acquired_at: input.acquiredAt ?? null,
        product_id: input.productId ?? null,
        physical_garment_id: input.physicalGarmentId ?? null,
        identifying_photo_url: input.identifyingPhotoUrl ?? null,
        created_by_actor: "advisor",
        created_by_staff_id: createdByStaffId,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toItem(data);
  }

  async updateState(
    retailerId: RetailerId,
    input: UpdateWardrobeItemStateInput,
  ): Promise<WardrobeItem> {
    const patch: Database["public"]["Tables"]["wardrobe_items"]["Update"] = {};
    if (input.condition !== undefined) patch.condition = input.condition;
    if (input.wearFrequency !== undefined) {
      patch.wear_frequency = input.wearFrequency;
    }
    if (input.careState !== undefined) patch.care_state = input.careState;
    if (input.fitPerception !== undefined) {
      patch.fit_perception = input.fitPerception;
    }
    if (input.careNotes !== undefined) patch.care_notes = input.careNotes;
    if (input.fitNotes !== undefined) patch.fit_notes = input.fitNotes;
    if (input.displayName !== undefined) patch.display_name = input.displayName;
    if (input.brand !== undefined) patch.brand = input.brand;
    if (input.description !== undefined) patch.description = input.description;

    const { data, error } = await this.client
      .from("wardrobe_items")
      .update(patch)
      .eq("id", input.wardrobeItemId)
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return toItem(data);
  }

  async retire(
    retailerId: RetailerId,
    wardrobeItemId: WardrobeItemId,
  ): Promise<WardrobeItem> {
    const { data, error } = await this.client
      .from("wardrobe_items")
      .update({
        condition: "retired",
        retired_at: new Date().toISOString(),
      })
      .eq("id", wardrobeItemId)
      .eq("retailer_id", retailerId)
      .is("deleted_at", null)
      .select("*")
      .single();
    if (error) throw error;
    return toItem(data);
  }
}
