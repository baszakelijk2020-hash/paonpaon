import { describe, expect, it } from "vitest";

import {
  PLATFORM_MODULES,
  moduleMayRunJob,
  moduleAllowsAccess,
  projectModuleNavigation,
  validateModuleDependencies,
  validateModulePlan,
  type RetailerModuleConfiguration,
} from "./module-kernel";

const core: RetailerModuleConfiguration = {
  moduleKey: "platform_core",
  state: "active",
  authorityMode: "paon",
  source: "plan",
};

describe("platform module registry", () => {
  it("defines the eight committed families once and in order", () => {
    expect(PLATFORM_MODULES.map((module) => module.familyOrder)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(new Set(PLATFORM_MODULES.map((module) => module.key)).size).toBe(8);
  });

  it("refuses an active module whose dependency is missing", () => {
    expect(
      validateModuleDependencies([
        {
          moduleKey: "wardrobe_styling",
          state: "active",
          authorityMode: "co_managed",
          source: "add_on",
        },
      ]),
    ).toEqual([
      {
        moduleKey: "wardrobe_styling",
        dependencyKey: "platform_core",
        reason: "missing",
      },
      {
        moduleKey: "wardrobe_styling",
        dependencyKey: "relationship_intelligence",
        reason: "missing",
      },
    ]);
  });

  it("allows a preview chain but never lets preview satisfy active", () => {
    const previewCore = { ...core, state: "preview" as const };
    const previewRelationship: RetailerModuleConfiguration = {
      moduleKey: "relationship_intelligence",
      state: "preview",
      authorityMode: "external",
      source: "override",
    };
    expect(
      validateModuleDependencies([previewCore, previewRelationship]),
    ).toEqual([]);
    expect(
      validateModuleDependencies([
        previewCore,
        { ...previewRelationship, state: "active" },
      ]),
    ).toEqual([
      {
        moduleKey: "relationship_intelligence",
        dependencyKey: "platform_core",
        reason: "not_active",
      },
    ]);
  });

  it("validates plan bundles through the same dependency contract", () => {
    expect(
      validateModulePlan({
        key: "intelligence",
        name: "Intelligence",
        moduleKeys: [
          "platform_core",
          "relationship_intelligence",
          "wardrobe_styling",
        ],
      }),
    ).toEqual([]);
    expect(
      validateModulePlan({
        key: "broken",
        name: "Broken",
        moduleKeys: ["platform_core", "network_ecosystem"],
      }),
    ).toHaveLength(2);
  });

  it("projects only entitled, role-appropriate navigation", () => {
    const navigation = projectModuleNavigation({
      configurations: [
        core,
        {
          moduleKey: "relationship_intelligence",
          state: "active",
          authorityMode: "co_managed",
          source: "plan",
        },
        {
          moduleKey: "retail_operations",
          state: "preview",
          authorityMode: "external",
          source: "add_on",
        },
        {
          moduleKey: "commerce_growth",
          state: "suspended",
          authorityMode: "paon",
          source: "override",
        },
      ],
      role: "sales_associate",
    });

    expect(navigation.map((item) => item.href)).toEqual([
      "/dashboard",
      "/notifications",
      "/customers",
      "/mission-control",
      "/appointments",
      "/messages",
      "/inventory",
      "/inventory/risk",
      "/pos",
      "/staff/recognition",
      "/staff/coverage",
    ]);
    expect(navigation.find((item) => item.href === "/pos")?.preview).toBe(true);
    expect(navigation.some((item) => item.href === "/orders")).toBe(false);
  });

  it("gives production specialists the order handoff without client access", () => {
    const navigation = projectModuleNavigation({
      configurations: [
        core,
        {
          moduleKey: "commerce_growth",
          state: "active",
          authorityMode: "paon",
          source: "plan",
        },
      ],
      role: "production_staff",
    });

    expect(navigation.some((item) => item.href === "/orders")).toBe(true);
    expect(navigation.some((item) => item.href === "/customers")).toBe(false);
  });

  it("suppresses every job unless its owning module is active", () => {
    const active: RetailerModuleConfiguration = {
      moduleKey: "wardrobe_styling",
      state: "active",
      authorityMode: "co_managed",
      source: "add_on",
    };
    expect(moduleMayRunJob(active, "morning_routine_delivery")).toBe(true);
    expect(
      moduleMayRunJob(
        { ...active, state: "preview" },
        "morning_routine_delivery",
      ),
    ).toBe(false);
    expect(moduleMayRunJob(active, "campaign_activation")).toBe(false);
  });

  it("keeps preview readable but refuses every mutation boundary", () => {
    const preview: RetailerModuleConfiguration = {
      moduleKey: "retail_operations",
      state: "preview",
      authorityMode: "external",
      source: "add_on",
    };
    expect(moduleAllowsAccess(preview, "read")).toBe(true);
    expect(moduleAllowsAccess(preview, "mutate")).toBe(false);
    expect(moduleAllowsAccess({ ...preview, state: "active" }, "mutate")).toBe(
      true,
    );
    expect(moduleAllowsAccess({ ...preview, state: "suspended" }, "read")).toBe(
      false,
    );
    expect(moduleAllowsAccess(undefined, "read")).toBe(false);
  });
});
