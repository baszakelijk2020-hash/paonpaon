import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import {
  CollectionRepository,
  CollectionSlugAlreadyExistsError,
} from "./collection-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type CollectionRow = Database["public"]["Tables"]["collections"]["Row"];

const row: CollectionRow = {
  id: "66666666-6666-6666-6666-666666666666",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  name: "Autumn 2026",
  slug: "autumn-2026",
  season: "FW26",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("CollectionRepository", () => {
  it("maps a row to a domain Collection", async () => {
    const repo = new CollectionRepository(
      clientReturning({ data: row, error: null }),
    );
    const collection = await repo.findById(row.id as never);
    expect(collection?.name).toBe("Autumn 2026");
    expect(collection?.season).toBe("FW26");
  });

  it("maps a list of rows in findByRetailer()", async () => {
    const repo = new CollectionRepository(
      clientReturning({ data: [row], error: null }),
    );
    const collections = await repo.findByRetailer(row.retailer_id as never);
    expect(collections).toHaveLength(1);
  });

  it("throws CollectionSlugAlreadyExistsError on a unique constraint violation", async () => {
    const repo = new CollectionRepository(
      clientReturning({
        data: null,
        error: { code: "23505", message: "duplicate" },
      }),
    );

    await expect(
      repo.create({
        retailerId: row.retailer_id as never,
        name: "Autumn 2026",
        slug: "autumn-2026",
      }),
    ).rejects.toBeInstanceOf(CollectionSlugAlreadyExistsError);
  });
});
