import { describe, expect, it } from "vitest";

import {
  addFitProfileEntryInputSchema,
  createCustomerInputSchema,
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

describe("addFitProfileEntryInputSchema", () => {
  it("accepts a measurements map with optional notes", () => {
    const result = addFitProfileEntryInputSchema.parse({
      measurements: { chest: "38in", waist: "32in" },
      fitPreferences: "Prefers a slim fit through the waist.",
    });
    expect(result.measurements).toEqual({ chest: "38in", waist: "32in" });
    expect(result.styleNotes).toBeUndefined();
  });

  it("accepts an empty measurements map (notes-only entry)", () => {
    const result = addFitProfileEntryInputSchema.safeParse({
      measurements: {},
      styleNotes: "Prefers muted tones.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank measurement value", () => {
    const result = addFitProfileEntryInputSchema.safeParse({
      measurements: { chest: "" },
    });
    expect(result.success).toBe(false);
  });
});
