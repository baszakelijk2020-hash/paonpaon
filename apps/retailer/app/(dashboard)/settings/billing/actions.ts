"use server";

import { requireRetailerRole } from "@paon/auth";
import { RetailerSubscriptionRepository } from "@paon/database";
import { createBillingPortalSession } from "@paon/payments";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface BillingActionState {
  formError?: string;
}

export async function openBillingPortal(
  _previous: BillingActionState,
  _formData: FormData,
): Promise<BillingActionState> {
  const session = await requireSession();
  requireRetailerRole(session.retailerRole, "admin");

  const stripe = getStripeClient();
  if (!stripe) {
    return {
      formError:
        'Stripe is not configured on this deployment — see docs/PROJECT_STATE.md "Credentials needed".',
    };
  }

  const supabase = await getSupabaseServerClient();
  const subscription = await new RetailerSubscriptionRepository(
    supabase,
  ).findByRetailer(session.retailerId);
  if (!subscription?.providerCustomerId) {
    return {
      formError:
        "No subscription yet — PAON Admin assigns your plan before billing can be managed here.",
    };
  }

  const url = await createBillingPortalSession(stripe, {
    customerId: subscription.providerCustomerId,
    returnUrl: `${env.appUrl}/settings/billing`,
  });
  redirect(url);
}
