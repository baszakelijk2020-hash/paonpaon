import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { CommercialProspectRepository } from "./commercial-prospect-repository";

describe("CommercialProspectRepository", () => {
  it("versions a demo configuration through one transactional RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    const repository = new CommercialProspectRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    const params = {
      prospectId: "11111111-1111-1111-1111-111111111111",
      planId: "22222222-2222-2222-2222-222222222222",
      theme: {
        accentColor: "#1a1a1a",
        surfaceColor: "#f5f3f0",
        inkColor: "#1a1a1a",
        displayFont: "paon_editorial",
        bodyFont: "quiet_sans",
        cornerStyle: "soft",
      } as const,
      marketingHeadline: "A composed client journey",
      personalizedIntroduction:
        "A retailer-specific environment built around one valuable outcome.",
      locations: [{ name: "Flagship", city: "London" }],
      productMix: ["tailoring" as const],
      featureKeys: ["crm", "appointments"],
      changeNote: "Initial researched configuration",
    };

    await expect(repository.saveConfiguration(params)).resolves.toBe(1);
    expect(rpc).toHaveBeenCalledWith("save_prospect_demo_configuration", {
      p_prospect_id: params.prospectId,
      p_plan_id: params.planId,
      p_theme: params.theme,
      p_marketing_headline: params.marketingHeadline,
      p_personalized_introduction: params.personalizedIntroduction,
      p_locations: params.locations,
      p_product_mix: params.productMix,
      p_feature_keys: params.featureKeys,
      p_change_note: params.changeNote,
    });
  });

  it("does not hide a transactional save failure", async () => {
    const repository = new CommercialProspectRepository({
      rpc: vi
        .fn()
        .mockResolvedValue({ data: null, error: new Error("denied") }),
    } as unknown as PaonSupabaseClient);

    await expect(
      repository.saveConfiguration({
        prospectId: "11111111-1111-1111-1111-111111111111",
        planId: "22222222-2222-2222-2222-222222222222",
        theme: {
          accentColor: "#1a1a1a",
          surfaceColor: "#f5f3f0",
          inkColor: "#1a1a1a",
          displayFont: "paon_editorial",
          bodyFont: "quiet_sans",
          cornerStyle: "soft",
        },
        marketingHeadline: "A composed client journey",
        personalizedIntroduction:
          "A retailer-specific environment built around one valuable outcome.",
        locations: [{ name: "Flagship", city: "London" }],
        productMix: ["tailoring"],
        featureKeys: ["crm"],
        changeNote: "Initial",
      }),
    ).rejects.toThrow("denied");
  });
});
