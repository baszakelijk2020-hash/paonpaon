import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";

import { StoreFeedbackRepository } from "./store-feedback-repository";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  retailer_id: "22222222-2222-2222-2222-222222222222",
  customer_id: null,
  garment_ref: "navy blazer",
  audience: "buying",
  feedback: "Three clients asked for a lighter lining.",
  idempotency_key: "feedback-1",
  status: "open",
  corrects_signal_id: null,
  acknowledged_at: null,
  follow_up_note: null,
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T00:00:00.000Z",
};

describe("StoreFeedbackRepository", () => {
  it("routes capture through the consent-gated RPC with an idempotency key", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: row, error: null });
    const signal = await new StoreFeedbackRepository({
      rpc,
    } as unknown as PaonSupabaseClient).capture({
      garmentRef: row.garment_ref,
      audience: "buying",
      feedback: row.feedback,
      idempotencyKey: row.idempotency_key,
    });
    expect(rpc).toHaveBeenCalledWith("capture_store_feedback_signal", {
      p_garment_ref: row.garment_ref,
      p_audience: "buying",
      p_feedback: row.feedback,
      p_idempotency_key: row.idempotency_key,
    });
    expect(signal.status).toBe("open");
  });

  it("refuses named feedback before persistence without recorded consent", async () => {
    const rpc = vi.fn();
    await expect(
      new StoreFeedbackRepository({
        rpc,
      } as unknown as PaonSupabaseClient).capture({
        customerId: "33333333-3333-3333-3333-333333333333",
        audience: "buying",
        feedback: "Asked for navy.",
        idempotencyKey: "feedback-2",
        personalizationConsent: "denied",
      }),
    ).rejects.toThrow("customer_consent_required");
    expect(rpc).not.toHaveBeenCalled();
  });
});
