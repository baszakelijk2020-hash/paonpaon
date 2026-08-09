import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { OutfitRepository } from "./outfit-repository";

type OutfitRow = Database["public"]["Tables"]["outfits"]["Row"];
type OutfitSlotRow = Database["public"]["Tables"]["outfit_slots"]["Row"];

type QueryResult = {
  readonly data: unknown;
  readonly error: unknown;
};

type QueryCall = readonly [method: string, ...args: readonly unknown[]];

type QueryBuilder = {
  select: (...args: readonly unknown[]) => QueryBuilder;
  eq: (...args: readonly unknown[]) => QueryBuilder;
  is: (...args: readonly unknown[]) => QueryBuilder;
  order: (...args: readonly unknown[]) => QueryBuilder;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
  then: (
    onfulfilled?: ((value: QueryResult) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) => Promise<unknown>;
};

const retailerId = "11111111-1111-1111-1111-111111111111";
const roadmapId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const staffId = "44444444-4444-4444-8444-444444444444";

const firstOutfit: OutfitRow = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  retailer_id: retailerId,
  customer_id: customerId,
  roadmap_id: roadmapId,
  title: "Arrival look",
  occasion_label: "client meeting",
  notes: "Tailored and grounded",
  created_by_staff_id: staffId,
  created_by_customer_id: null,
  is_suggestion_generation: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const secondOutfit: OutfitRow = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  retailer_id: retailerId,
  customer_id: customerId,
  roadmap_id: roadmapId,
  title: "Evening look",
  occasion_label: null,
  notes: null,
  created_by_staff_id: null,
  created_by_customer_id: customerId,
  is_suggestion_generation: false,
  created_at: "2026-01-02T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
  deleted_at: null,
};

const firstSlot: OutfitSlotRow = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  outfit_id: firstOutfit.id,
  retailer_id: retailerId,
  slot_kind: "jacket",
  wardrobe_item_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  product_id: null,
  label: "Jacket",
  available: true,
  display_order: 1,
  created_at: "2026-01-01T00:00:00.000Z",
};

const secondSlot: OutfitSlotRow = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  outfit_id: secondOutfit.id,
  retailer_id: retailerId,
  slot_kind: "trousers",
  wardrobe_item_id: null,
  product_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  label: "Trousers",
  available: true,
  display_order: 2,
  created_at: "2026-01-02T00:00:00.000Z",
};

function createBuilder(result: QueryResult, calls: QueryCall[]): QueryBuilder {
  const builder: QueryBuilder = {
    select: (...args) => {
      calls.push(["select", ...args]);
      return builder;
    },
    eq: (...args) => {
      calls.push(["eq", ...args]);
      return builder;
    },
    is: (...args) => {
      calls.push(["is", ...args]);
      return builder;
    },
    order: (...args) => {
      calls.push(["order", ...args]);
      return builder;
    },
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (onfulfilled, onrejected) =>
      Promise.resolve(result).then(onfulfilled, onrejected),
  };
  return builder;
}

function clientWithSequence(sequence: Record<string, readonly QueryResult[]>) {
  const callLog: Record<string, QueryCall[][]> = {};
  const callCounts: Record<string, number> = {};
  const fromCalls: string[] = [];

  const client = {
    from: (table: string) => {
      fromCalls.push(table);
      const index = callCounts[table] ?? 0;
      callCounts[table] = index + 1;
      const result = sequence[table]?.[index];
      if (!result) {
        throw new Error(`unexpected query for ${table} #${index + 1}`);
      }
      const tableCalls: QueryCall[] = [];
      (callLog[table] ??= []).push(tableCalls);
      return createBuilder(result, tableCalls);
    },
  } as unknown as PaonSupabaseClient;

  return { client, callLog, fromCalls };
}

describe("OutfitRepository.findByRoadmap", () => {
  it("filters by roadmap, excludes deleted outfits, loads slots, and preserves creation order", async () => {
    const { client, callLog, fromCalls } = clientWithSequence({
      outfits: [
        {
          data: [firstOutfit, secondOutfit],
          error: null,
        },
      ],
      outfit_slots: [
        {
          data: [firstSlot],
          error: null,
        },
        {
          data: [secondSlot],
          error: null,
        },
      ],
    });

    const outfits = await new OutfitRepository(client).findByRoadmap(
      roadmapId as never,
    );

    const outfitsCalls = callLog.outfits ?? [];
    const outfitSlotCalls = callLog.outfit_slots ?? [];

    expect(fromCalls).toEqual(["outfits", "outfit_slots", "outfit_slots"]);
    expect(outfitsCalls[0]).toEqual([
      ["select", "*"],
      ["eq", "roadmap_id", roadmapId],
      ["is", "deleted_at", null],
      ["order", "created_at", { ascending: true }],
    ]);
    expect(outfitSlotCalls[0]).toEqual([
      ["select", "*"],
      ["eq", "outfit_id", firstOutfit.id],
      ["order", "display_order", { ascending: true }],
    ]);
    expect(outfitSlotCalls[1]).toEqual([
      ["select", "*"],
      ["eq", "outfit_id", secondOutfit.id],
      ["order", "display_order", { ascending: true }],
    ]);
    expect(outfits.map((outfit) => outfit.id)).toEqual([
      firstOutfit.id,
      secondOutfit.id,
    ]);
    expect(outfits[0]).toMatchObject({
      id: firstOutfit.id,
      roadmapId,
      createdByStaffId: staffId,
      slots: [
        {
          id: firstSlot.id,
          outfitId: firstOutfit.id,
          retailerId,
          slotKind: "jacket",
          wardrobeItemId: firstSlot.wardrobe_item_id,
          label: "Jacket",
          available: true,
          displayOrder: 1,
        },
      ],
    });
    expect(outfits[1]).toMatchObject({
      id: secondOutfit.id,
      roadmapId,
      createdByCustomerId: customerId,
      slots: [
        {
          id: secondSlot.id,
          outfitId: secondOutfit.id,
          retailerId,
          slotKind: "trousers",
          productId: secondSlot.product_id,
          label: "Trousers",
          available: true,
          displayOrder: 2,
        },
      ],
    });
  });

  it("throws when the outfits query errors", async () => {
    const { client } = clientWithSequence({
      outfits: [
        {
          data: null,
          error: new Error("roadmap query failed"),
        },
      ],
      outfit_slots: [],
    });

    await expect(
      new OutfitRepository(client).findByRoadmap(roadmapId as never),
    ).rejects.toThrow("roadmap query failed");
  });

  it("throws when loading slots for a roadmap outfit fails", async () => {
    const { client } = clientWithSequence({
      outfits: [
        {
          data: [firstOutfit],
          error: null,
        },
      ],
      outfit_slots: [
        {
          data: null,
          error: new Error("slot query failed"),
        },
      ],
    });

    await expect(
      new OutfitRepository(client).findByRoadmap(roadmapId as never),
    ).rejects.toThrow("slot query failed");
  });
});
