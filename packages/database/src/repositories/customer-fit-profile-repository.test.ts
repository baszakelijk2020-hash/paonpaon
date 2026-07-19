import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerFitProfileRepository } from "./customer-fit-profile-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type FitProfileEntryRow =
  Database["public"]["Tables"]["customer_fit_profile_entries"]["Row"];

const row: FitProfileEntryRow = {
  id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  customer_id: "44444444-4444-4444-4444-444444444444",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  measurements: { chest: "38in", waist: "32in" },
  fit_preferences: "Slim fit through the waist.",
  style_notes: null,
  recorded_by_staff_id: null,
  recorded_at: "2026-01-01T00:00:00.000Z",
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("CustomerFitProfileRepository", () => {
  it("maps a row to a domain CustomerFitProfileEntry", async () => {
    const repo = new CustomerFitProfileRepository(
      clientReturning({ data: [row], error: null }),
    );
    const history = await repo.findHistory(row.customer_id as never);
    expect(history).toHaveLength(1);
    expect(history[0]?.measurements).toEqual({ chest: "38in", waist: "32in" });
    expect(history[0]?.styleNotes).toBeUndefined();
  });

  it("findCurrent maps the most recent row", async () => {
    const repo = new CustomerFitProfileRepository(
      clientReturning({ data: row, error: null }),
    );
    const current = await repo.findCurrent(row.customer_id as never);
    expect(current?.fitPreferences).toBe("Slim fit through the waist.");
  });

  it("findCurrent returns null when no entry exists", async () => {
    const repo = new CustomerFitProfileRepository(
      clientReturning({ data: null, error: null }),
    );
    const current = await repo.findCurrent(row.customer_id as never);
    expect(current).toBeNull();
  });

  it("add() maps the inserted row back to a domain entry", async () => {
    const repo = new CustomerFitProfileRepository(
      clientReturning({ data: row, error: null }),
    );
    const entry = await repo.add({
      customerId: row.customer_id as never,
      retailerId: row.retailer_id as never,
      measurements: { chest: "38in" },
    });
    expect(entry.customerId).toBe(row.customer_id);
  });
});
