"use server";

import { requirePlatformOperator } from "@paon/auth";
import {
  RetailerRepository,
  RetailerStaffRepository,
  RetailerSubscriptionRepository,
  SubscriptionPlanRepository,
} from "@paon/database";
import { asId, assignSubscriptionPlanInputSchema } from "@paon/domain";
import {
  createPlatformCustomer,
  createPlatformSubscription,
} from "@paon/payments";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface BillingActionState {
  formError?: string;
  saved?: boolean;
}

/**
 * Assigns a subscription plan to a retailer — creates the real Stripe
 * Customer/Subscription on first assignment, then records the result.
 * Platform-staff-initiated only, see docs/DECISIONS.md ADR-031.
 */
export async function assignSubscriptionPlan(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  const session = await getSession();
  requirePlatformOperator(session);

  const parsed = assignSubscriptionPlanInputSchema.safeParse({
    retailerId: formData.get("retailerId"),
    planId: formData.get("planId"),
  });
  if (!parsed.success) {
    return { formError: "Choose a valid plan." };
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return {
      formError:
        'Stripe is not configured on this deployment — see docs/PROJECT_STATE.md "Credentials needed".',
    };
  }

  const supabase = await getSupabaseServerClient();
  const retailerId = asId<"RetailerId">(parsed.data.retailerId);
  const planId = asId<"SubscriptionPlanId">(parsed.data.planId);

  const plan = await new SubscriptionPlanRepository(supabase).findById(planId);
  if (!plan) {
    return { formError: "Plan not found." };
  }
  if (!plan.providerPriceId) {
    return {
      formError:
        "This plan has no Stripe Price configured yet — set one on the Billing page first.",
    };
  }

  const retailer = await new RetailerRepository(supabase).findById(retailerId);
  if (!retailer) {
    return { formError: "Retailer not found." };
  }

  const subscriptionRepo = new RetailerSubscriptionRepository(supabase);
  const existing = await subscriptionRepo.findByRetailer(retailerId);
  if (existing) {
    return {
      formError:
        "This retailer already has a subscription — cancel it in the Stripe dashboard before assigning a different plan (plan changes aren't built yet).",
    };
  }

  try {
    const owner = (
      await new RetailerStaffRepository(supabase).findByRetailer(retailerId)
    ).find((member) => member.role === "owner");

    const customer = await createPlatformCustomer(stripe, {
      name: retailer.legalName,
      ...(owner ? { email: owner.email } : {}),
      retailerId,
    });
    const subscription = await createPlatformSubscription(stripe, {
      customerId: customer.id,
      priceId: plan.providerPriceId,
      retailerId,
    });

    await subscriptionRepo.create({
      retailerId,
      planId,
      providerCustomerId: customer.id,
      providerSubscriptionId: subscription.providerSubscriptionId,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      ...(subscription.currentPeriodStart
        ? { currentPeriodStart: subscription.currentPeriodStart }
        : {}),
      ...(subscription.currentPeriodEnd
        ? { currentPeriodEnd: subscription.currentPeriodEnd }
        : {}),
      ...(subscription.trialEndsAt
        ? { trialEndsAt: subscription.trialEndsAt }
        : {}),
    });
  } catch (error) {
    return {
      formError: error instanceof Error ? error.message : "Assignment failed",
    };
  }

  revalidatePath(`/retailers/${retailerId}`);
  return { saved: true };
}
