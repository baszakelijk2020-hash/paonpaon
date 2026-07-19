import { describe, expect, it } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import {
  RetailerRepository,
  SlugAlreadyExistsError,
} from "./retailer-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type RetailerRow = Database["public"]["Tables"]["retailers"]["Row"];

const row: RetailerRow = {
  id: "11111111-1111-1111-1111-111111111111",
  legal_name: "Atelier Demo, Inc.",
  display_name: "Atelier Demo",
  slug: "atelier-demo",
  status: "pending_onboarding",
  tier: "house",
  primary_domain: null,
  billing_address: {
    line1: "1 Rue de la Paix",
    city: "Paris",
    postalCode: "75002",
    countryCode: "FR",
  },
  default_currency: "USD",
  default_locale: "en-US",
  brand_theme: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function clientReturning(result: {
  data: unknown;
  error: unknown;
}): PaonSupabaseClient {
  return {
    from: () => fakeQueryBuilder(result as never),
  } as unknown as PaonSupabaseClient;
}

describe("RetailerRepository", () => {
  it("maps a row to a domain Retailer, omitting a null primaryDomain", async () => {
    const repo = new RetailerRepository(
      clientReturning({ data: row, error: null }),
    );
    const retailer = await repo.findById(row.id as never);

    expect(retailer).not.toBeNull();
    expect(retailer?.displayName).toBe("Atelier Demo");
    expect(retailer?.status).toBe("pending_onboarding");
    expect("primaryDomain" in (retailer ?? {})).toBe(false);
  });

  it("returns null when no row is found", async () => {
    const repo = new RetailerRepository(
      clientReturning({ data: null, error: null }),
    );
    const retailer = await repo.findById("missing" as never);
    expect(retailer).toBeNull();
  });

  it("maps a list of rows in list()", async () => {
    const repo = new RetailerRepository(
      clientReturning({ data: [row], error: null }),
    );
    const retailers = await repo.list();
    expect(retailers).toHaveLength(1);
    expect(retailers[0]?.slug).toBe("atelier-demo");
  });

  it("throws SlugAlreadyExistsError on a unique constraint violation", async () => {
    const repo = new RetailerRepository(
      clientReturning({
        data: null,
        error: { code: "23505", message: "duplicate" },
      }),
    );

    await expect(
      repo.create({
        legalName: "X",
        displayName: "X",
        slug: "atelier-demo",
        tier: "house",
        defaultCurrency: "USD",
        defaultLocale: "en-US",
        billingAddress: {
          line1: "1",
          city: "Paris",
          postalCode: "75002",
          countryCode: "FR",
        },
      }),
    ).rejects.toBeInstanceOf(SlugAlreadyExistsError);
  });
});
