import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerPreferencesRepository } from "./customer-preferences-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type CustomerPreferencesRow =
  Database["public"]["Tables"]["customer_preferences"]["Row"];

const preferencesRow: CustomerPreferencesRow = {
  customer_id: "44444444-4444-4444-4444-444444444444",
  preferred_locale: "en-US",
  preferred_currency: "USD",
  communication_channels: ["email"],
  style_notes: null,
  marketing_opt_in: false,
  personalization_opt_in: false,
  location_opt_in: false,
  personalization_withdrawn_at: null,
  marketing_withdrawn_at: null,
  location_withdrawn_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("CustomerPreferencesRepository", () => {
  it("maps a row to a domain CustomerPreferences", async () => {
    const repo = new CustomerPreferencesRepository(
      clientReturning({ data: preferencesRow, error: null }),
    );
    const preferences = await repo.findByCustomer(
      preferencesRow.customer_id as never,
    );
    expect(preferences?.preferredLocale).toBe("en-US");
    expect(preferences?.communicationChannels).toEqual(["email"]);
    expect(preferences?.styleNotes).toBeUndefined();
  });

  it("returns null when the customer has no preferences saved yet", async () => {
    const repo = new CustomerPreferencesRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findByCustomer("nonexistent" as never)).toBeNull();
  });

  it("upserts preferences and returns the saved row", async () => {
    const savedRow: CustomerPreferencesRow = {
      ...preferencesRow,
      style_notes: "Prefers wool over cashmere.",
      marketing_opt_in: true,
    };
    const repo = new CustomerPreferencesRepository(
      clientReturning({ data: savedRow, error: null }),
    );
    const preferences = await repo.upsert(preferencesRow.customer_id as never, {
      preferredLocale: "en-US",
      preferredCurrency: "USD",
      communicationChannels: ["email"],
      styleNotes: "Prefers wool over cashmere.",
      marketingOptIn: true,
      personalizationOptIn: false,
      locationOptIn: false,
    });
    expect(preferences.styleNotes).toBe("Prefers wool over cashmere.");
    expect(preferences.marketingOptIn).toBe(true);
    expect(preferences.personalizationOptIn).toBe(false);
    expect(preferences.locationOptIn).toBe(false);
  });
});
