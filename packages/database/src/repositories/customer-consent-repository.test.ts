import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { CustomerConsentRepository } from "./customer-consent-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type PreferencesRow =
  Database["public"]["Tables"]["customer_preferences"]["Row"];

const preferencesRow: PreferencesRow = {
  customer_id: "44444444-4444-4444-4444-444444444444",
  preferred_locale: "en-US",
  preferred_currency: "USD",
  communication_channels: ["email"],
  style_notes: null,
  marketing_opt_in: false,
  personalization_opt_in: true,
  location_opt_in: false,
  personalization_withdrawn_at: null,
  marketing_withdrawn_at: null,
  location_withdrawn_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("CustomerConsentRepository", () => {
  it("maps preference flags into purpose-specific consent state", async () => {
    const repo = new CustomerConsentRepository({
      from: () => fakeQueryBuilder({ data: preferencesRow, error: null }),
    } as unknown as PaonSupabaseClient);
    const state = await repo.getState(
      "11111111-1111-1111-1111-111111111111" as never,
      preferencesRow.customer_id as never,
    );
    expect(state.personalization.status).toBe("granted");
    expect(state.marketing.status).toBe("denied");
    expect(state.location.status).toBe("denied");
  });

  it("builds a capture snapshot from current consent", async () => {
    const repo = new CustomerConsentRepository({
      from: () => fakeQueryBuilder({ data: preferencesRow, error: null }),
    } as unknown as PaonSupabaseClient);
    const snapshot = await repo.snapshotForCapture(
      "11111111-1111-1111-1111-111111111111" as never,
      preferencesRow.customer_id as never,
      "2026-07-30T00:00:00.000Z",
    );
    expect(snapshot).toEqual({
      personalization: "granted",
      marketing: "denied",
      location: "denied",
      capturedAt: "2026-07-30T00:00:00.000Z",
      basis: "explicit_opt_in",
    });
  });

  it("withdraws personalization through the consent RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repo = new CustomerConsentRepository({
      rpc,
    } as unknown as PaonSupabaseClient);
    await repo.setConsent(preferencesRow.customer_id as never, {
      purpose: "personalization",
      status: "withdrawn",
      reason: "Customer requested deletion of signals",
    });
    expect(rpc).toHaveBeenCalledWith("set_customer_consent", {
      p_customer_id: preferencesRow.customer_id,
      p_purpose: "personalization",
      p_status: "withdrawn",
      p_reason: "Customer requested deletion of signals",
    });
  });
});
