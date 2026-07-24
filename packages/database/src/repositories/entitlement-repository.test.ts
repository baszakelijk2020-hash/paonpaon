import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { EntitlementRepository } from "./entitlement-repository";

describe("EntitlementRepository", () => {
  it("delegates authorization to the database entitlement function", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const repository = new EntitlementRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.retailerHas("retailer-id" as never, "appointments"),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("retailer_has_entitlement", {
      p_retailer_id: "retailer-id",
      p_feature_key: "appointments",
    });
  });

  it("does not turn an entitlement lookup error into access", async () => {
    const repository = new EntitlementRepository({
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("denied") }),
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.retailerHas("retailer-id" as never, "crm"),
    ).rejects.toThrow("denied");
  });
});
