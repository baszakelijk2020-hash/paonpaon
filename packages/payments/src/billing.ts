import type Stripe from "stripe";

/**
 * PAON's own platform Stripe account — a retailer paying PAON, the
 * reverse direction from `connect.ts`'s "customer pays retailer".
 * Founder decision: Stripe Billing under the platform account, kept
 * entirely separate from Connect. See docs/DECISIONS.md ADR-031.
 */

export function toIso(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

export async function createPlatformCustomer(
  stripe: Stripe,
  params: { name: string; email?: string; retailerId: string },
): Promise<Stripe.Customer> {
  return stripe.customers.create({
    name: params.name,
    ...(params.email ? { email: params.email } : {}),
    metadata: { retailerId: params.retailerId },
  });
}

export interface CreatedSubscription {
  providerSubscriptionId: string;
  status: Stripe.Subscription.Status;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
}

/** Period dates live on the subscription item, not the subscription itself, as of recent Stripe API versions — MVP scope is always a single-price subscription, so `items.data[0]` is safe. */
export async function createPlatformSubscription(
  stripe: Stripe,
  params: { customerId: string; priceId: string; retailerId: string },
): Promise<CreatedSubscription> {
  const subscription = await stripe.subscriptions.create({
    customer: params.customerId,
    items: [{ price: params.priceId }],
    metadata: { retailerId: params.retailerId },
  });
  return toCreatedSubscription(subscription);
}

export function toCreatedSubscription(
  subscription: Stripe.Subscription,
): CreatedSubscription {
  const item = subscription.items.data[0];
  return {
    providerSubscriptionId: subscription.id,
    status: subscription.status,
    ...(item
      ? {
          currentPeriodStart: toIso(item.current_period_start),
          currentPeriodEnd: toIso(item.current_period_end),
        }
      : {}),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    ...(subscription.trial_end
      ? { trialEndsAt: toIso(subscription.trial_end) }
      : {}),
  };
}

/** The Stripe-hosted portal where a retailer manages their own payment method and views invoices — PAON never handles card details directly. */
export async function createBillingPortalSession(
  stripe: Stripe,
  params: { customerId: string; returnUrl: string },
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
  return session.url;
}
