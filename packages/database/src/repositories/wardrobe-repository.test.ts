import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";
import { WardrobeRepository } from "./wardrobe-repository";

type WardrobeItemRow = Database["public"]["Tables"]["wardrobe_items"]["Row"];
type OwnershipEventRow =
  Database["public"]["Tables"]["wardrobe_ownership_events"]["Row"];

const itemRow: WardrobeItemRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  retailer_id: "11111111-1111-4111-8111-111111111111",
  customer_id: "22222222-2222-4222-8222-222222222222",
  ownership_kind: "external",
  provenance_source: "customer_added",
  category_code: "jacket",
  display_name: "Navy blazer",
  brand: "Elsewhere",
  description: "Bought abroad",
  condition: "good",
  wear_frequency: "occasionally",
  care_state: "current",
  fit_perception: "true_to_size",
  care_notes: null,
  fit_notes: "Comfortable in the chest",
  acquired_at: "2026-01-15T00:00:00.000Z",
  product_id: null,
  order_line_id: null,
  physical_garment_id: null,
  identifying_photo_url: null,
  created_by_actor: "customer",
  created_by_staff_id: null,
  retired_at: null,
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  deleted_at: null,
};

const catalogueRow: WardrobeItemRow = {
  ...itemRow,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  ownership_kind: "retailer_purchased",
  provenance_source: "order_line",
  display_name: "Smoke-grey trousers",
  brand: "House",
  description: null,
  condition: "new",
  wear_frequency: null,
  fit_perception: "unknown",
  fit_notes: null,
  product_id: "33333333-3333-4333-8333-333333333333",
  order_line_id: "44444444-4444-4444-8444-444444444444",
  created_by_actor: "advisor",
  created_by_staff_id: "55555555-5555-4555-8555-555555555555",
};

const eventRow: OwnershipEventRow = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  retailer_id: itemRow.retailer_id,
  customer_id: itemRow.customer_id,
  wardrobe_item_id: itemRow.id,
  event_kind: "acquired",
  ownership_kind: "external",
  provenance_source: "customer_added",
  actor_kind: "customer",
  actor_staff_id: null,
  note: null,
  occurred_at: "2026-01-15T00:00:00.000Z",
  created_at: "2026-07-30T00:00:00.000Z",
};

describe("WardrobeRepository", () => {
  it("maps external and catalogue items without conflating PhysicalGarment", async () => {
    const from = vi
      .fn()
      .mockReturnValue(
        fakeQueryBuilder({ data: [itemRow, catalogueRow], error: null }),
      );
    const repo = new WardrobeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const items = await repo.findByCustomer(itemRow.customer_id as never);
    expect(items).toHaveLength(2);
    expect(items[0]?.ownershipKind).toBe("external");
    expect(items[0]?.physicalGarmentId).toBeUndefined();
    expect(items[1]?.ownershipKind).toBe("retailer_purchased");
    expect(items[1]?.orderLineId).toBe(catalogueRow.order_line_id);
    expect(items[1]?.productId).toBe(catalogueRow.product_id);
  });

  it("lists ownership history for an item", async () => {
    const repo = new WardrobeRepository({
      from: () => fakeQueryBuilder({ data: [eventRow], error: null }),
    } as unknown as PaonSupabaseClient);

    const events = await repo.listOwnershipHistory(itemRow.id as never);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventKind).toBe("acquired");
    expect(events[0]?.provenanceSource).toBe("customer_added");
  });

  it("inserts an external customer item with ownership provenance", async () => {
    const insert = vi
      .fn()
      .mockReturnValue(fakeQueryBuilder({ data: itemRow, error: null }));
    const from = vi.fn().mockReturnValue({ insert });
    const repo = new WardrobeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const created = await repo.createExternalItem({
      retailerId: itemRow.retailer_id,
      customerId: itemRow.customer_id,
      categoryCode: "jacket",
      displayName: "Navy blazer",
      brand: "Elsewhere",
      description: "Bought abroad",
      condition: "good",
      wearFrequency: "occasionally",
      careState: "current",
      fitPerception: "true_to_size",
      fitNotes: "Comfortable in the chest",
      acquiredAt: "2026-01-15T00:00:00.000Z",
    });

    expect(from).toHaveBeenCalledWith("wardrobe_items");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ownership_kind: "external",
        provenance_source: "customer_added",
        created_by_actor: "customer",
        created_by_staff_id: null,
        product_id: null,
      }),
    );
    expect(created.displayName).toBe("Navy blazer");
  });

  it("inserts a catalogue-linked retailer-purchased item for advisors", async () => {
    const insert = vi
      .fn()
      .mockReturnValue(fakeQueryBuilder({ data: catalogueRow, error: null }));
    const from = vi.fn().mockReturnValue({ insert });
    const repo = new WardrobeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    await repo.createCatalogueItem(
      {
        retailerId: catalogueRow.retailer_id,
        customerId: catalogueRow.customer_id,
        categoryCode: "trousers",
        displayName: "Smoke-grey trousers",
        brand: "House",
        condition: "new",
        careState: "current",
        fitPerception: "unknown",
        productId: catalogueRow.product_id!,
        orderLineId: catalogueRow.order_line_id!,
      },
      catalogueRow.created_by_staff_id as never,
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ownership_kind: "retailer_purchased",
        provenance_source: "order_line",
        created_by_actor: "advisor",
        product_id: catalogueRow.product_id,
        order_line_id: catalogueRow.order_line_id,
      }),
    );
  });

  it("retires an item by setting retired condition and timestamp", async () => {
    const retired: WardrobeItemRow = {
      ...itemRow,
      condition: "retired",
      retired_at: "2026-07-30T12:00:00.000Z",
    };
    const update = vi
      .fn()
      .mockReturnValue(fakeQueryBuilder({ data: retired, error: null }));
    const from = vi.fn().mockReturnValue({ update });
    const repo = new WardrobeRepository({
      from,
    } as unknown as PaonSupabaseClient);

    const result = await repo.retire(
      itemRow.retailer_id as never,
      itemRow.id as never,
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        condition: "retired",
        retired_at: expect.any(String),
      }),
    );
    expect(result.condition).toBe("retired");
    expect(result.retiredAt).toBeDefined();
  });
});
