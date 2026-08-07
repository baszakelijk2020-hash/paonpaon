/**
 * Complete-look outfit persistence (PHASE 4.2 / ROAD-002 / ADR-063).
 */

import {
  asId,
  isOutfitSlotsConsistent,
  type CreateOutfitInput,
  type CustomerId,
  type Outfit,
  type OutfitId,
  type OutfitSlot,
  type OutfitSlotKind,
  type StaffId,
  type WardrobeRoadmapId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type OutfitRow = Database["public"]["Tables"]["outfits"]["Row"];
type OutfitSlotRow = Database["public"]["Tables"]["outfit_slots"]["Row"];

function toSlot(row: OutfitSlotRow): OutfitSlot {
  return {
    id: asId<"OutfitSlotId">(row.id),
    outfitId: asId<"OutfitId">(row.outfit_id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    slotKind: row.slot_kind as OutfitSlotKind,
    ...(row.wardrobe_item_id
      ? { wardrobeItemId: asId<"WardrobeItemId">(row.wardrobe_item_id) }
      : {}),
    ...(row.product_id ? { productId: asId<"ProductId">(row.product_id) } : {}),
    label: row.label,
    available: row.available,
    displayOrder: row.display_order,
  };
}

function toOutfit(row: OutfitRow, slots: readonly OutfitSlot[]): Outfit {
  return {
    id: asId<"OutfitId">(row.id),
    retailerId: asId<"RetailerId">(row.retailer_id),
    customerId: asId<"CustomerId">(row.customer_id),
    ...(row.roadmap_id
      ? { roadmapId: asId<"WardrobeRoadmapId">(row.roadmap_id) }
      : {}),
    title: row.title,
    ...(row.occasion_label ? { occasionLabel: row.occasion_label } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    ...(row.created_by_staff_id
      ? { createdByStaffId: asId<"StaffId">(row.created_by_staff_id) }
      : {}),
    ...(row.created_by_customer_id
      ? { createdByCustomerId: asId<"CustomerId">(row.created_by_customer_id) }
      : {}),
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slots,
  };
}

export class OutfitRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findById(id: OutfitId): Promise<Outfit | null> {
    const { data, error } = await this.client
      .from("outfits")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const slots = await this.listSlots(asId<"OutfitId">(data.id));
    return toOutfit(data, slots);
  }

  async findByCustomer(customerId: CustomerId): Promise<Outfit[]> {
    const { data, error } = await this.client
      .from("outfits")
      .select("*")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return Promise.all(
      data.map(async (row) =>
        toOutfit(row, await this.listSlots(asId<"OutfitId">(row.id))),
      ),
    );
  }

  /** The advisor visual roadmap's "up to 12 looks" (VWS-001 / PHASE 4.9) —
   * outfits linked to one WardrobeRoadmap via `roadmapId`, in creation
   * order so the advisor's authored sequence is stable. */
  async findByRoadmap(roadmapId: WardrobeRoadmapId): Promise<Outfit[]> {
    const { data, error } = await this.client
      .from("outfits")
      .select("*")
      .eq("roadmap_id", roadmapId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return Promise.all(
      data.map(async (row) =>
        toOutfit(row, await this.listSlots(asId<"OutfitId">(row.id))),
      ),
    );
  }

  async create(
    input: CreateOutfitInput,
    createdByStaffId: StaffId,
  ): Promise<Outfit> {
    return this.insertOutfitAndSlots(input, {
      created_by_staff_id: createdByStaffId as string,
      created_by_customer_id: null,
    });
  }

  /** Customer composing their own try-on look (VWS-001 / PHASE 4.6) —
   * same slot-consistency rules as advisor authorship, just a different
   * author column. RLS enforces the caller is that exact customer. */
  async createByCustomer(
    input: CreateOutfitInput,
    createdByCustomerId: CustomerId,
  ): Promise<Outfit> {
    return this.insertOutfitAndSlots(input, {
      created_by_staff_id: null,
      created_by_customer_id: createdByCustomerId as string,
    });
  }

  private async insertOutfitAndSlots(
    input: CreateOutfitInput,
    author: {
      readonly created_by_staff_id: string | null;
      readonly created_by_customer_id: string | null;
    },
  ): Promise<Outfit> {
    if (
      !isOutfitSlotsConsistent({
        slots: input.slots.map((slot) => ({
          slotKind: slot.slotKind,
          available: slot.available,
          wardrobeItemId: slot.wardrobeItemId ?? null,
          productId: slot.productId ?? null,
        })),
      })
    ) {
      throw new Error("Outfit slots failed consistency rules.");
    }

    const { data, error } = await this.client
      .from("outfits")
      .insert({
        retailer_id: input.retailerId,
        customer_id: input.customerId,
        roadmap_id: input.roadmapId ?? null,
        title: input.title,
        occasion_label: input.occasionLabel ?? null,
        notes: input.notes ?? null,
        created_by_staff_id: author.created_by_staff_id,
        created_by_customer_id: author.created_by_customer_id,
      })
      .select("*")
      .single();
    if (error) throw error;

    const slotRows = input.slots.map((slot) => ({
      outfit_id: data.id,
      retailer_id: input.retailerId as string,
      slot_kind: slot.slotKind,
      wardrobe_item_id: slot.wardrobeItemId ?? null,
      product_id: slot.productId ?? null,
      label: slot.label,
      available: slot.available,
      display_order: slot.displayOrder,
    }));

    const { data: insertedSlots, error: slotError } = await this.client
      .from("outfit_slots")
      .insert(slotRows)
      .select("*");
    if (slotError) throw slotError;

    return toOutfit(data, insertedSlots.map(toSlot));
  }

  private async listSlots(outfitId: OutfitId): Promise<OutfitSlot[]> {
    const { data, error } = await this.client
      .from("outfit_slots")
      .select("*")
      .eq("outfit_id", outfitId)
      .order("display_order", { ascending: true });
    if (error) throw error;
    return data.map(toSlot);
  }
}
