import { describe, expect, it } from "vitest";

import {
  createCustomerInputSchema,
  upsertCustomerPreferencesInputSchema,
} from "./customer.schema";

describe("createCustomerInputSchema", () => {
  it("accepts a minimal payload and defaults lifecycleStage to prospect", () => {
    const result = createCustomerInputSchema.parse({
      fullName: "Jane Shopper",
    });
    expect(result.lifecycleStage).toBe("prospect");
    expect(result.email).toBeUndefined();
  });

  it("normalizes email casing", () => {
    const result = createCustomerInputSchema.parse({
      fullName: "Jane Shopper",
      email: "Jane@Example.com",
    });
    expect(result.email).toBe("jane@example.com");
  });

  it("rejects an invalid email", () => {
    const result = createCustomerInputSchema.safeParse({
      fullName: "Jane Shopper",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing full name", () => {
    const result = createCustomerInputSchema.safeParse({ fullName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported lifecycle stage", () => {
    const result = createCustomerInputSchema.safeParse({
      fullName: "Jane Shopper",
      lifecycleStage: "regular",
    });
    expect(result.success).toBe(false);
  });
});

describe("upsertCustomerPreferencesInputSchema", () => {
  it("defaults every field for a first-time save", () => {
    const result = upsertCustomerPreferencesInputSchema.parse({});
    expect(result).toEqual({
      preferredLocale: "en-US",
      preferredCurrency: "USD",
      communicationChannels: ["email"],
      marketingOptIn: false,
      personalizationOptIn: false,
      locationOptIn: false,
    });
  });

  it("accepts a full payload", () => {
    const result = upsertCustomerPreferencesInputSchema.parse({
      preferredLocale: "fr-FR",
      preferredCurrency: "EUR",
      communicationChannels: ["email", "sms"],
      styleNotes: "Prefers wool over cashmere.",
      marketingOptIn: true,
    });
    expect(result.communicationChannels).toEqual(["email", "sms"]);
    expect(result.styleNotes).toBe("Prefers wool over cashmere.");
  });

  it("rejects an unsupported currency", () => {
    const result = upsertCustomerPreferencesInputSchema.safeParse({
      preferredCurrency: "XYZ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported communication channel", () => {
    const result = upsertCustomerPreferencesInputSchema.safeParse({
      communicationChannels: ["carrier_pigeon"],
    });
    expect(result.success).toBe(false);
  });
});
