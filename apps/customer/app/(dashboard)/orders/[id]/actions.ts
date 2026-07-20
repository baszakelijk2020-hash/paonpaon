"use server";

import {
  OrderRepository,
  RetailerStripeAccountRepository,
} from "@paon/database";
import { asId, createCheckoutSessionInputSchema } from "@paon/domain";
import { createDirectChargeCheckoutSession } from "@paon/payments";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";
import { getStripeClient } from "@/lib/stripe";
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
