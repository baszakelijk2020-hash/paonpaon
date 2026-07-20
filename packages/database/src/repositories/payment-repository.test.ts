import { describe, expect, it, vi } from "vitest";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

import { PaymentRepository } from "./payment-repository";
import { fakeQueryBuilder } from "./test-helpers/fake-query-builder";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

const paymentRow: PaymentRow = {
  id: "22222222-2222-2222-2222-222222222222",
  order_id: "33333333-3333-3333-3333-333333333333",
  provider: "stripe",
  provider_payment_intent_id: "pi_123",
  amount_minor_units: 450000,
  currency: "USD",
  platform_fee_amount_minor_units: 11250,
  status: "captured",
  captured_at: "2026-01-01T00:00:00.000Z",
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

describe("PaymentRepository", () => {
  it("maps a row to a domain Payment, splitting amount and platformFee", async () => {
    const repo = new PaymentRepository(
      clientReturning({ data: paymentRow, error: null }),
    );
    const payment = await repo.findByOrder(paymentRow.order_id as never);
    expect(payment?.amount).toEqual({
      amountMinorUnits: 450000,
      currency: "USD",
    });
    expect(payment?.platformFee).toEqual({
      amountMinorUnits: 11250,
      currency: "USD",
    });
    expect(payment?.providerReference).toBe("pi_123");
    expect(payment?.status).toBe("captured");
  });

  it("returns null when the order has no payment yet", async () => {
    const repo = new PaymentRepository(
      clientReturning({ data: null, error: null }),
    );
    expect(await repo.findByOrder("nonexistent" as never)).toBeNull();
  });

  it("findByProviderReference maps a row by provider_payment_intent_id", async () => {
    const repo = new PaymentRepository(
      clientReturning({ data: paymentRow, error: null }),
    );
    const payment = await repo.findByProviderReference("pi_123");
    expect(payment?.orderId).toBe(paymentRow.order_id);
  });

  it("recordStripeEvent calls the protected RPC with the right params", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repo = new PaymentRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repo.recordStripeEvent({
      eventId: "evt_123",
      eventType: "checkout.session.completed",
      orderId: paymentRow.order_id as never,
      providerPaymentIntentId: "pi_123",
      amountMinorUnits: 450000,
      currency: "USD",
      status: "captured",
      platformFeeAmountMinorUnits: 11250,
    });

    expect(rpc).toHaveBeenCalledWith("record_stripe_payment_event", {
      p_event_id: "evt_123",
      p_event_type: "checkout.session.completed",
      p_order_id: paymentRow.order_id,
      p_provider_payment_intent_id: "pi_123",
      p_amount_minor_units: 450000,
      p_currency: "USD",
      p_status: "captured",
      p_platform_fee_amount_minor_units: 11250,
    });
  });

  it("recordStripeEvent defaults platformFeeAmountMinorUnits to 0", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repo = new PaymentRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await repo.recordStripeEvent({
      eventId: "evt_124",
      eventType: "payment_intent.payment_failed",
      orderId: paymentRow.order_id as never,
      providerPaymentIntentId: "pi_124",
      amountMinorUnits: 450000,
      currency: "USD",
      status: "failed",
    });

    expect(rpc).toHaveBeenCalledWith(
      "record_stripe_payment_event",
      expect.objectContaining({ p_platform_fee_amount_minor_units: 0 }),
    );
  });

  it("throws when the RPC returns an error", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error("boom") });
    const repo = new PaymentRepository({
      rpc,
    } as unknown as PaonSupabaseClient);

    await expect(
      repo.recordStripeEvent({
        eventId: "evt_125",
        eventType: "checkout.session.completed",
        orderId: paymentRow.order_id as never,
        providerPaymentIntentId: "pi_125",
        amountMinorUnits: 450000,
        currency: "USD",
        status: "captured",
      }),
    ).rejects.toThrow("boom");
  });
});
