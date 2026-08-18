import { asId, type RetailerBranch } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { RetailerBranchRepository } from "./retailer-branch-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type Row = Database["public"]["Tables"]["retailer_branches"]["Row"];

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const now = "2026-07-30T12:00:00.000Z";

function branchRow(overrides: Partial<Row> & Pick<Row, "id" | "name">): Row {
  return {
    retailer_id: retailerId,
    timezone: "Europe/Amsterdam",
    is_default: true,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    store_type: null,
    address_line1: null,
    address_line2: null,
    city: null,
    region: null,
    postal_code: null,
    country: null,
    latitude: null,
    longitude: null,
    phone: null,
    contact_email: null,
    opening_hours: [],
    services: [],
    contact_actions: [],
    filter_categories: [],
    imagery: [],
    presentation_mode: "map",
    published: false,
    ...overrides,
  };
}

describe("RetailerBranchRepository", () => {
  it("lists tenant branches and prefers the default", async () => {
    const rows = [
      branchRow({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        name: "Main house",
        is_default: true,
      }),
      branchRow({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
        name: "Annex",
        is_default: false,
        timezone: "Europe/London",
      }),
    ];
    const from = vi.fn(() => fakeQueryBuilder({ data: rows, error: null }));
    const repo = new RetailerBranchRepository({
      from,
    } as unknown as PaonSupabaseClient);
    const listed = await repo.listByRetailer(retailerId);
    expect(listed).toHaveLength(2);
    const def = await repo.findDefault(retailerId);
    expect((def as RetailerBranch).name).toBe("Main house");
  });

  it("rejects unsupported timezone on create", async () => {
    const repo = new RetailerBranchRepository({
      from: vi.fn(),
    } as unknown as PaonSupabaseClient);
    await expect(
      repo.create({
        retailerId,
        name: "Bad",
        timezone: "NotAZone",
      }),
    ).rejects.toThrow(/Unsupported timezone/);
  });
});
