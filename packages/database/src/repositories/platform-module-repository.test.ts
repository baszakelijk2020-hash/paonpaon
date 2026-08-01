import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { PlatformModuleRepository } from "./platform-module-repository";

describe("PlatformModuleRepository", () => {
  it("resolves subscription and overrides through one database boundary", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          module_key: "platform_core",
          state: "active",
          authority_mode: "paon",
          source: "plan",
        },
        {
          module_key: "retail_operations",
          state: "preview",
          authority_mode: "external",
          source: "add_on",
        },
      ],
      error: null,
    });
    const repository = new PlatformModuleRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.resolveRetailer("retailer-id" as never),
    ).resolves.toEqual([
      {
        moduleKey: "platform_core",
        state: "active",
        authorityMode: "paon",
        source: "plan",
      },
      {
        moduleKey: "retail_operations",
        state: "preview",
        authorityMode: "external",
        source: "add_on",
      },
    ]);
    expect(rpc).toHaveBeenCalledWith("resolve_retailer_modules", {
      p_retailer_id: "retailer-id",
    });
  });

  it("configures lifecycle and authority atomically", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: "configuration-id", error: null });
    const repository = new PlatformModuleRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.configure({
        retailerId: "retailer-id" as never,
        moduleKey: "network_ecosystem",
        state: "suspended",
        authorityMode: "co_managed",
        source: "override",
        reason: "Partner activation paused",
      }),
    ).resolves.toBe("configuration-id");
    expect(rpc).toHaveBeenCalledWith("set_retailer_module_configuration", {
      p_retailer_id: "retailer-id",
      p_module_key: "network_ecosystem",
      p_state: "suspended",
      p_authority_mode: "co_managed",
      p_source: "override",
      p_reason: "Partner activation paused",
    });
  });

  it("fails closed when module resolution errors", async () => {
    const repository = new PlatformModuleRepository({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("denied"),
      }),
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.resolveRetailer("retailer-id" as never),
    ).rejects.toThrow("denied");
  });

  it("replaces a plan bundle through the dependency-validating RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repository = new PlatformModuleRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repository.replacePlanModules("plan-id" as never, [
      "platform_core",
      "relationship_intelligence",
    ]);
    expect(rpc).toHaveBeenCalledWith("replace_subscription_plan_modules", {
      p_plan_id: "plan-id",
      p_module_keys: ["platform_core", "relationship_intelligence"],
    });
  });
});
