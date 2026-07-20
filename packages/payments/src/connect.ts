import type Stripe from "stripe";

/**
 * Every retailer is merchant of record (founder decision) — Stripe
 * Connect Express, direct charges on the connected account, never
 * destination charges. PAON only facilitates: an optional
 * `application_fee_amount` (see `RetailerStripeAccount.platformFeeBasisPoints`)
 * is the only money that ever routes to PAON's own platform balance.
 */
export async function createExpressAccount(
  stripe: Stripe,
  params: { email?: string; country: string },
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: "express",
    country: params.country,
    ...(params.email ? { email: params.email } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

export async function createAccountOnboardingLink(
  stripe: Stripe,
  params: { accountId: string; refreshUrl: string; returnUrl: string },
): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Express dashboard login link — the Connect equivalent of Retailer Portal's own session, scoped to that one account. */
export async function createExpressDashboardLoginLink(
  stripe: Stripe,
  accountId: string,
): Promise<string> {
  const link = await stripe.accounts.createLoginLink(accountId);
  return link.url;
}

export interface AccountCapabilityStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export function toAccountCapabilityStatus(
  account: Stripe.Account,
): AccountCapabilityStatus {
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

export interface CreateDirectChargeCheckoutSessionParams {
  connectedAccountId: string;
  amountMinorUnits: number;
  currency: string;
  platformFeeAmountMinorUnits: number;
  orderId: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
}

/**
 * A single line item covering the order's already-computed total — the
 * cart/checkout flow (`checkout_cart`, ADR-024) is where price/stock
 * revalidation happens; this only turns an already-`pending_payment`
 * order into money actually moving. `metadata.orderId` on both the
 * session and the PaymentIntent is how the webhook maps a Stripe event
 * back to our `orders` row.
 */
export async function createDirectChargeCheckoutSession(
  stripe: Stripe,
  params: CreateDirectChargeCheckoutSessionParams,
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            unit_amount: params.amountMinorUnits,
            product_data: { name: params.productName },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        ...(params.platformFeeAmountMinorUnits > 0
          ? { application_fee_amount: params.platformFeeAmountMinorUnits }
          : {}),
        metadata: { orderId: params.orderId },
      },
      metadata: { orderId: params.orderId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    },
    { stripeAccount: params.connectedAccountId },
  );
}
