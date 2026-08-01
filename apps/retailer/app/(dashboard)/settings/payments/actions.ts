"use server";

import { requireRetailerRole } from "@paon/auth";
import {
  RetailerRepository,
  RetailerStripeAccountRepository,
} from "@paon/database";
import {
  createAccountOnboardingLink,
  createExpressAccount,
  createExpressDashboardLoginLink,
} from "@paon/payments";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { requireModuleSession } from "@/lib/module-session";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export interface PaymentsActionState {
  formError?: string;
}

const NOT_CONFIGURED_ERROR =
  'Stripe is not configured on this deployment (STRIPE_SECRET_KEY missing) — see docs/PROJECT_STATE.md "Credentials needed".';

/**
 * Starts (or resumes) Stripe Connect Express onboarding for this
 * retailer — creates the real Express account on first call, then
 * always issues a fresh account link and redirects there. See
 * docs/DECISIONS.md ADR-030.
 */
export async function connectStripeAccount(
  _previous: PaymentsActionState,
  _formData: FormData,
): Promise<PaymentsActionState> {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "admin");

  const stripe = getStripeClient();
  if (!stripe) {
    return { formError: NOT_CONFIGURED_ERROR };
  }

  const supabase = await getSupabaseServerClient();
  const accountRepo = new RetailerStripeAccountRepository(supabase);

  let account = await accountRepo.findByRetailer(session.retailerId);
  if (!account) {
    const retailer = await new RetailerRepository(supabase).findById(
      session.retailerId,
    );
    if (!retailer) {
      return { formError: "Retailer not found." };
    }
    const stripeAccount = await createExpressAccount(stripe, {
      email: session.email,
      country: retailer.billingAddress.countryCode,
    });
    account = await accountRepo.create(session.retailerId, stripeAccount.id);
  }

  const returnUrl = `${env.appUrl}/settings/payments`;
  const url = await createAccountOnboardingLink(stripe, {
    accountId: account.stripeAccountId,
    refreshUrl: returnUrl,
    returnUrl,
  });

  redirect(url);
}

export async function openStripeExpressDashboard(
  _previous: PaymentsActionState,
  _formData: FormData,
): Promise<PaymentsActionState> {
  const session = await requireModuleSession("commerce_growth");
  requireRetailerRole(session.retailerRole, "admin");

  const stripe = getStripeClient();
  if (!stripe) {
    return { formError: NOT_CONFIGURED_ERROR };
  }

  const supabase = await getSupabaseServerClient();
  const account = await new RetailerStripeAccountRepository(
    supabase,
  ).findByRetailer(session.retailerId);
  if (!account) {
    return { formError: "Connect a Stripe account first." };
  }

  const url = await createExpressDashboardLoginLink(
    stripe,
    account.stripeAccountId,
  );
  redirect(url);
}
