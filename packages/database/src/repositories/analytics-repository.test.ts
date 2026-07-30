import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { AnalyticsRepository } from "./analytics-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type Row = Database["public"]["Tables"]["behavioral_events"]["Row"];

const consentSnapshot = {
  personalization: "granted",
  marketing: "denied",
  location: "denied",
  capturedAt: "2026-07-20T00:00:00.000Z",
  basis: "explicit_opt_in",
};

const row: Row = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  retailer_id: "11111111-1111-1111-1111-111111111111",
  customer_id: "44444444-4444-4444-4444-444444444444",
  anonymous_session_id: null,
  session_id: null,
  correlation_id: null,
  idempotency_key: null,
  received_at: null,
  page_path: null,
  device_class: null,
  name: "product_viewed",
  properties: { productId: "product-1" },
  source: "customer_portal",
  occurred_at: "2026-07-20T00:00:00.000Z",
  created_at: "2026-07-20T00:00:00.000Z",
  purpose: "personalization",
  consent_basis: "explicit_opt_in",
  consent_snapshot: consentSnapshot,
  retention_class: "personalization_signal",
  retention_expires_at: "2027-07-20T00:00:00.000Z",
  anonymized_at: null,
};

describe("AnalyticsRepository", () => {
  it("maps recent signal rows to the consented domain event", async () => {
    const client = {
      from: () => fakeQueryBuilder({ data: [row], error: null }),
    } as unknown as PaonSupabaseClient;
    const events = await new AnalyticsRepository(client).findRecent(
      row.retailer_id as never,
    );
    expect(events[0]).toMatchObject({
      name: "product_viewed",
      source: "customer_portal",
      purpose: "personalization",
      retentionClass: "personalization_signal",
      consentSnapshot: {
        personalization: "granted",
        basis: "explicit_opt_in",
      },
    });
  });

  it("findRecentByCustomer scopes to usable consented signals", async () => {
    const from = vi.fn(() => fakeQueryBuilder({ data: [row], error: null }));
    const client = { from } as unknown as PaonSupabaseClient;
    const events = await new AnalyticsRepository(client).findRecentByCustomer(
      row.retailer_id as never,
      row.customer_id as never,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.name).toBe("product_viewed");
    expect(from).toHaveBeenCalledWith("behavioral_events");
  });

  it("captures with consent snapshot and retention fields", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row.id, error: null });
    const repository = new AnalyticsRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    await expect(
      repository.capture({
        retailerId: row.retailer_id as never,
        customerId: row.customer_id as never,
        name: "product_viewed",
        properties: { productId: "product-1" },
        occurredAt: row.occurred_at,
        source: "customer_portal",
        purpose: "personalization",
        consentBasis: "explicit_opt_in",
        consentSnapshot: consentSnapshot as never,
        retentionClass: "personalization_signal",
        retentionExpiresAt: row.retention_expires_at,
      }),
    ).resolves.toBe(row.id);
    expect(rpc).toHaveBeenCalledWith(
      "capture_behavioral_event",
      expect.objectContaining({
        p_name: "product_viewed",
        p_purpose: "personalization",
        p_consent_basis: "explicit_opt_in",
        p_retention_class: "personalization_signal",
      }),
    );
  });

  it("uses the protected summary RPC", async () => {
    const summary = {
      customers: 10,
      newCustomers: 2,
      orders: 3,
      revenueMinorUnits: 90000,
      appointments: 4,
      openAlterations: 1,
      eventRsvps: 5,
      messages: 6,
      behavioralEvents: 7,
    };
    const rpc = vi.fn().mockResolvedValue({ data: summary, error: null });
    const repository = new AnalyticsRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    await expect(
      repository.summary(row.retailer_id as never, "2026-06-20T00:00:00.000Z"),
    ).resolves.toEqual(summary);
    expect(rpc).toHaveBeenCalledWith("get_retailer_analytics", {
      p_retailer_id: row.retailer_id,
      p_since: "2026-06-20T00:00:00.000Z",
    });
  });

  it("uses the platform-only analytics RPC", async () => {
    const data = {
      retailers: 3,
      activeRetailers: 2,
      newRetailers: 1,
      customers: 20,
      newCustomers: 4,
      orders: 7,
      grossMerchandiseValueByCurrency: { EUR: 120000 },
      appointments: 6,
      openAlterations: 2,
      messages: 8,
      behavioralEvents: 9,
    };
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    const repository = new AnalyticsRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    await expect(
      repository.platformSummary("2026-06-20T00:00:00.000Z"),
    ).resolves.toEqual(data);
    expect(rpc).toHaveBeenCalledWith("get_platform_analytics", {
      p_since: "2026-06-20T00:00:00.000Z",
    });
  });
});
