import { describe, expect, it } from "vitest";

import {
  createCommercialProspectInputSchema,
  saveProspectDemoConfigurationInputSchema,
} from "./commercial-prospect.schema";

describe("commercial prospect schemas", () => {
  it("accepts research context without customer data", () => {
    const result = createCommercialProspectInputSchema.parse({
      companyName: "Maison Example",
      websiteUrl: "https://example.com",
      primaryContactName: "Amelia Retailer",
      primaryContactEmail: "AMELIA@example.com",
      source: "founder_outreach",
      salesNotes: "Strong appointment practice with disconnected follow-up.",
      observedOpportunities: ["Connect fitting and relationship follow-up"],
      recommendedPlanId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.primaryContactEmail).toBe("amelia@example.com");
  });

  it("accepts optional location photography", () => {
    const result = saveProspectDemoConfigurationInputSchema.parse({
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
        "A deliberately personalized product narrative for this retailer.",
      locations: [
        {
          name: "Flagship",
          city: "London",
          imageUrl: "https://example.com/store.jpg",
        },
      ],
      productMix: ["tailoring"],
      featureKeys: ["appointments"],
      changeNote: "Location photo",
    });
    expect(result.locations[0]?.imageUrl).toBe("https://example.com/store.jpg");
  });

  it("rejects unsafe demo assets and empty scope", () => {
    const result = saveProspectDemoConfigurationInputSchema.safeParse({
      prospectId: "11111111-1111-1111-1111-111111111111",
      planId: "22222222-2222-2222-2222-222222222222",
      theme: {
        logoUrl: "javascript:alert(1)",
        accentColor: "#1a1a1a",
        surfaceColor: "#f5f3f0",
        inkColor: "#1a1a1a",
        displayFont: "paon_editorial",
        bodyFont: "quiet_sans",
        cornerStyle: "soft",
      },
      marketingHeadline: "A composed client journey",
      personalizedIntroduction:
        "A deliberately personalized product narrative for this retailer.",
      locations: [],
      productMix: [],
      featureKeys: [],
      changeNote: "Initial",
    });
    expect(result.success).toBe(false);
  });
});
