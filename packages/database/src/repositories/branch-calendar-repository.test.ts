import { asId } from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { BranchCalendarRepository } from "./branch-calendar-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type BranchRow = Database["public"]["Tables"]["retailer_branches"]["Row"];

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");

describe("BranchCalendarRepository", () => {
  it("lists tenant branches ordered with primary first", async () => {
    const rows: BranchRow[] = [
      {
        created_at: "2026-07-30T12:00:00.000Z",
        deleted_at: null,
        id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
        is_primary: true,
        name: "Main salon",
        retailer_id: retailerId,
        timezone: "America/New_York",
        updated_at: "2026-07-30T12:00:00.000Z",
      },
    ];
    const from = vi.fn(() =>
      fakeQueryBuilder({
        data: rows,
        error: null,
      }),
    );
    const client = { from } as unknown as PaonSupabaseClient;
    const branches = await new BranchCalendarRepository(client).listBranches(
      retailerId,
    );
    expect(branches[0]?.timezone).toBe("America/New_York");
    expect(from).toHaveBeenCalledWith("retailer_branches");
  });
});
