import { describe, expect, it } from "vitest";

import {
  createRetailerInputSchema,
  updateRetailerProfileInputSchema,
} from "./retailer.schema";

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

describe("updateRetailerProfileInputSchema", () => {
  const validProfile = {
    legalName: "Atelier Demo, Inc.",
    displayName: "Atelier Demo",
    defaultLocale: "en-US",
    billingAddress: {
      line1: "1 Rue de la Paix",
      city: "Paris",
      postalCode: "75002",
      countryCode: "fr",
    },
  };

  it("accepts a valid payload without primaryDomain", () => {
    const result = updateRetailerProfileInputSchema.parse(validProfile);
    expect(result.primaryDomain).toBeUndefined();
  });

  it("normalizes an empty primaryDomain to undefined", () => {
    const result = updateRetailerProfileInputSchema.parse({
      ...validProfile,
      primaryDomain: "",
    });
    expect(result.primaryDomain).toBeUndefined();
  });

  it("accepts a provided primaryDomain", () => {
    const result = updateRetailerProfileInputSchema.parse({
      ...validProfile,
      primaryDomain: "atelier-demo.com",
    });
    expect(result.primaryDomain).toBe("atelier-demo.com");
  });

  it("rejects a missing display name", () => {
    const result = updateRetailerProfileInputSchema.safeParse({
      ...validProfile,
      displayName: "",
    });
    expect(result.success).toBe(false);
  });

  it("does not accept slug, tier, status or defaultCurrency fields", () => {
    const result = updateRetailerProfileInputSchema.parse({
      ...validProfile,
      slug: "hijacked-slug",
      tier: "maison",
      status: "active",
      defaultCurrency: "EUR",
    } as unknown as typeof validProfile);
    expect(result).not.toHaveProperty("slug");
    expect(result).not.toHaveProperty("tier");
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("defaultCurrency");
  });
});
