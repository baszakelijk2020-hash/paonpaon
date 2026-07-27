import { requireRetailerRole } from "@paon/auth";
import { RetailerStripeAccountRepository } from "@paon/database";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentsPanel } from "./payments-panel";

import { env } from "@/lib/env";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function PaymentsSettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const account = await new RetailerStripeAccountRepository(
    supabase,
  ).findByRetailer(session.retailerId);

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
          Payments
        </h1>
      </div>
      <PaymentsPanel
        account={account}
        stripeConfigured={!!env.stripeSecretKey}
      />
    </div>
  );
}
