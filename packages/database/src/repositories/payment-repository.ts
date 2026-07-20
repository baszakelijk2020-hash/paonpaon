import {
  asId,
  type CurrencyCode,
  type OrderId,
  type Payment,
  type PaymentStatus,
} from "@paon/domain";

import type { PaonSupabaseClient } from "../client-type";
import type { Database } from "../generated/database.types";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];

function toDomain(row: PaymentRow): Payment {
  return {
    id: asId<"PaymentId">(row.id),
    orderId: asId<"OrderId">(row.order_id),
    amount: {
      amountMinorUnits: row.amount_minor_units,
      currency: row.currency as CurrencyCode,
    },
    platformFee: {
      amountMinorUnits: row.platform_fee_amount_minor_units,
      currency: row.currency as CurrencyCode,
    },
    status: row.status,
    provider: row.provider as Payment["provider"],
    providerReference: row.provider_payment_intent_id,
    ...(row.captured_at ? { capturedAt: row.captured_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** See `docs/ARCHITECTURE.md` "Data access layer" — this repository is the only code allowed to query `payments`. */
export class PaymentRepository {
  constructor(private readonly client: PaonSupabaseClient) {}

  async findByOrder(orderId: OrderId): Promise<Payment | null> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /** Used by the webhook's `charge.refunded` handler to map a Stripe PaymentIntent id back to our order — Stripe's refund event carries no `orderId` metadata of its own. */
  async findByProviderReference(
    providerPaymentIntentId: string,
  ): Promise<Payment | null> {
    const { data, error } = await this.client
      .from("payments")
      .select("*")
      .eq("provider", "stripe")
      .eq("provider_payment_intent_id", providerPaymentIntentId)
      .maybeSingle();
    if (error) throw error;
    return data ? toDomain(data) : null;
  }

  /**
   * The only write path — wraps `record_stripe_payment_event`
   * (service-role only, see the migration comment). Idempotent at both
   * the Stripe event level and the payment-record level.
   */
  async recordStripeEvent(params: {
    eventId: string;
    eventType: string;
    orderId: OrderId;
    providerPaymentIntentId: string;
    amountMinorUnits: number;
    currency: string;
    status: PaymentStatus;
    platformFeeAmountMinorUnits?: number;
  }): Promise<void> {
    const { error } = await this.client.rpc("record_stripe_payment_event", {
      p_event_id: params.eventId,
      p_event_type: params.eventType,
      p_order_id: params.orderId,
      p_provider_payment_intent_id: params.providerPaymentIntentId,
      p_amount_minor_units: params.amountMinorUnits,
      p_currency: params.currency,
      p_status: params.status,
      p_platform_fee_amount_minor_units:
        params.platformFeeAmountMinorUnits ?? 0,
    });
    if (error) throw error;
  }
}
