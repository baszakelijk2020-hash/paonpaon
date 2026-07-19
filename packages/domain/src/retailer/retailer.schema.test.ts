import { describe, expect, it } from "vitest";

import { createRetailerInputSchema } from "./retailer.schema";

const validInput = {
  legalName: "Atelier Demo, Inc.",
  displayName: "Atelier Demo",
  slug: "atelier-demo",
  tier: "house",
  defaultCurrency: "USD",
  defaultLocale: "en-US",
  billingAddress: {
    line1: "1 Rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    countryCode: "fr",
  },
  ownerFullName: "Jane Owner",
  ownerEmail: "Jane@Atelier.com",
};

describe("createRetailerInputSchema", () => {
  it("accepts a valid payload and normalizes casing", () => {
    const result = createRetailerInputSchema.parse(validInput);
    expect(result.billingAddress.countryCode).toBe("FR");
    expect(result.ownerEmail).toBe("jane@atelier.com");
  });

  it("rejects an invalid slug", () => {
    const result = createRetailerInputSchema.safeParse({
      ...validInput,
      slug: "Not A Slug!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid owner email", () => {
    const result = createRetailerInputSchema.safeParse({
      ...validInput,
      ownerEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a country code that isn't 2 letters", () => {
    const result = createRetailerInputSchema.safeParse({
      ...validInput,
      billingAddress: { ...validInput.billingAddress, countryCode: "FRA" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported tier", () => {
    const result = createRetailerInputSchema.safeParse({
      ...validInput,
      tier: "flagship",
    });
    expect(result.success).toBe(false);
  });
});
