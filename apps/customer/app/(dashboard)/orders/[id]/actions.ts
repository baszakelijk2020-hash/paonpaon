"use server";

import {
  HoneymoonProgrammeRepository,
  OrderRepository,
  PaymentRepository,
  RetailerStripeAccountRepository,
} from "@paon/database";
import { asId, createCheckoutSessionInputSchema } from "@paon/domain";
import { createDirectChargeCheckoutSession } from "@paon/payments";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PayActionState {
  formError?: string;
}

/**
 * Creates a Stripe Checkout Session for an already-`pending_payment`
 * order and redirects there. Never trusts a client-supplied amount —
 * everything is re-derived from the order and the retailer's connected
 * account. See docs/DECISIONS.md ADR-030.
 */
export async function createCheckoutSession(
  _previous: PayActionState,
  formData: FormData,
): Promise<PayActionState> {
  await requireSession();

  const parsed = createCheckoutSessionInputSchema.safeParse({
    orderId: formData.get("orderId"),
  });
  if (!parsed.success) {
    return { formError: "Invalid order." };
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return {
      formError:
        'Payments are not configured on this deployment yet — see docs/PROJECT_STATE.md "Credentials needed".',
    };
  }

  const supabase = await getSupabaseServerClient();
  const orderId = asId<"OrderId">(parsed.data.orderId);
  const order = await new OrderRepository(supabase).findById(orderId);
  if (!order) {
    return { formError: "Order not found." };
  }
  if (order.status !== "pending_payment") {
    return { formError: "This order is not awaiting payment." };
  }

  const account = await new RetailerStripeAccountRepository(
    supabase,
  ).findByRetailer(order.retailerId);
  if (!account || !account.chargesEnabled) {
    return {
      formError: "This retailer hasn't finished setting up payments yet.",
    };
  }

  const platformFeeAmountMinorUnits = Math.round(
    (order.total.amountMinorUnits * account.platformFeeBasisPoints) / 10000,
  );

  const session = await createDirectChargeCheckoutSession(stripe, {
    connectedAccountId: account.stripeAccountId,
    amountMinorUnits: order.total.amountMinorUnits,
    currency: order.total.currency,
    platformFeeAmountMinorUnits,
    orderId: order.id,
    productName: `Order ${order.orderNumber}`,
    successUrl: `${env.appUrl}/orders/${order.id}?payment=success`,
    cancelUrl: `${env.appUrl}/orders/${order.id}?payment=canceled`,
  });

  if (!session.url) {
    return { formError: "Could not start checkout — try again." };
  }

  redirect(session.url);
}

/**
 * The customer's explicit choice to defer payment to collection instead of
 * paying via Stripe Checkout now — Honeymoon Phase expansion. This never
 * marks the order paid or moves money; `pending_payment` stays exactly
 * that until Stripe succeeds or staff use `markPaidInStore` at collection.
 * It only tells retailer staff not to expect (or chase) an online payment.
 * The order lookup uses the session-scoped client, not the admin client:
 * RLS on `orders` naturally returns null for an order that isn't this
 * customer's, so a foreign orderId fails closed here exactly like
 * `createCheckoutSession` above.
 */
export async function choosePayAtDelivery(orderId: string): Promise<void> {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const order = await new OrderRepository(supabase).findById(
    asId<"OrderId">(orderId),
  );
  if (!order) throw new Error("Order not found.");
  if (order.status !== "pending_payment") {
    throw new Error("This order is not awaiting payment.");
  }

  const admin = getSupabaseAdminClient();
  const honeymoonRepo = new HoneymoonProgrammeRepository(admin);
  const programme = await honeymoonRepo.findByOrder(order.retailerId, order.id);
  if (!programme) {
    throw new Error("Pay at delivery isn't available for this order.");
  }
  await honeymoonRepo.setPayAtDelivery(order.retailerId, programme.id, true);
  revalidatePath(`/orders/${orderId}`);
}

/**
 * Demo/mock payment path — only available when BOTH Stripe is unconfigured
 * AND `DEMO_PAYMENTS_ENABLED=true` is explicitly set. Stripe-absent alone is
 * not sufficient: a live retailer who simply hasn't finished Stripe
 * onboarding yet is a normal, expected state (see `createCheckoutSession`'s
 * "hasn't finished setting up payments yet" branch) — without the explicit
 * flag, any of that retailer's real customers could call this action
 * directly and mark a real order "paid" for free. Records a payment with a
 * synthetic reference (never confused with real Stripe charges).
 */
export async function simulateDemoPayment(
  _previous: PayActionState,
  formData: FormData,
): Promise<PayActionState> {
  await requireSession();

  // Gate: only available when Stripe is NOT configured AND demo mode is explicitly opted in.
  const stripe = getStripeClient();
  if (stripe || !env.demoPaymentsEnabled) {
    throw new Error("Demo payment is not available on this deployment.");
  }

  const parsed = createCheckoutSessionInputSchema.safeParse({
    orderId: formData.get("orderId"),
  });
  if (!parsed.success) {
    return { formError: "Invalid order." };
  }

  const supabase = await getSupabaseServerClient();
  const orderId = asId<"OrderId">(parsed.data.orderId);
  const order = await new OrderRepository(supabase).findById(orderId);
  if (!order) {
    return { formError: "Order not found." };
  }
  if (order.status !== "pending_payment") {
    return { formError: "This order is not awaiting payment." };
  }

  // Create a synthetic payment record with a clearly demo reference
  const timestamp = Date.now();
  const demoReference = `demo_${timestamp}`;

  const admin = getSupabaseAdminClient();
  const paymentRepo = new PaymentRepository(admin);

  try {
    await paymentRepo.recordStripeEvent({
      eventId: demoReference,
      eventType: "demo.payment_simulated",
      orderId: order.id,
      providerPaymentIntentId: demoReference,
      amountMinorUnits: order.total.amountMinorUnits,
      currency: order.total.currency,
      status: "captured",
      platformFeeAmountMinorUnits: 0,
    });
  } catch (error) {
    return {
      formError: `Failed to process demo payment: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }

  // Revalidate so the page re-fetches and shows the updated payment status
  revalidatePath(`/orders/${orderId}`);

  // Redirect with success parameter to show confirmation message
  redirect(`/orders/${orderId}?payment=success`);
}
