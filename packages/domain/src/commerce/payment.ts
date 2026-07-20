import type { OrderId, PaymentId, RetailerId } from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

export type PaymentStatus =
  "pending" | "authorized" | "captured" | "refunded" | "failed";

export type PaymentProvider = "stripe";

/**
 * One Payment per Order (MVP scope — multiple payment attempts or
 * partial refunds per order are a later enhancement, not modeled
 * speculatively now). `providerReference` is the Stripe PaymentIntent
 * id: the idempotency anchor a redelivered webhook event is matched
 * against — see `record_stripe_payment_event`, docs/DECISIONS.md
 * ADR-030. Every retailer is merchant of record (Stripe Connect direct
 * charges, not destination charges) — `platformFee` is the optional
 * `application_fee_amount` PAON may configure per retailer, zero unless
 * a platform operator sets `RetailerStripeAccount.platformFeeBasisPoints`.
 */
export interface Payment extends Timestamps {
  readonly id: PaymentId;
  readonly orderId: OrderId;
  readonly amount: Money;
  readonly platformFee: Money;
  readonly status: PaymentStatus;
  readonly provider: PaymentProvider;
  readonly providerReference: string;
  readonly capturedAt?: string;
}

/**
 * A retailer's Stripe Connect Express account — the destination for
 * their own customers' payments (they are merchant of record, PAON
 * only facilitates). Distinct from `RetailerSubscription`
 * (`retailer/subscription.ts`), which is the reverse direction: the
 * retailer paying PAON, on PAON's own platform Stripe account.
 */
export interface RetailerStripeAccount extends Timestamps {
  readonly retailerId: RetailerId;
  readonly stripeAccountId: string;
  readonly chargesEnabled: boolean;
  readonly payoutsEnabled: boolean;
  readonly detailsSubmitted: boolean;
  /** Platform-controlled, like `Retailer.defaultCurrency` — never retailer-editable. Basis points (0–10000); 0 unless a platform operator configures a fee. */
  readonly platformFeeBasisPoints: number;
}
