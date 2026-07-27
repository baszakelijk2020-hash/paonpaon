import { requireRetailerRole } from "@paon/auth";
import {
  RetailerSubscriptionRepository,
  SubscriptionPlanRepository,
} from "@paon/database";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BillingPanel } from "./billing-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function BillingSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const subscription = await new RetailerSubscriptionRepository(
    supabase,
  ).findByRetailer(session.retailerId);
  const plan = subscription
    ? await new SubscriptionPlanRepository(supabase).findById(
        subscription.planId,
      )
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/settings"
          className="mb-1 inline-block text-sm text-[var(--color-stone-500)] hover:underline"
        >
          ← Settings
        </Link>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Billing
        </h1>
      </div>
      <BillingPanel subscription={subscription} plan={plan} />
    </div>
  );
}
