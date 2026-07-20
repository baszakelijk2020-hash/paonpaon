import { requireRetailerRole } from "@paon/auth";
import { RetailerRepository } from "@paon/database";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SettingsForm } from "./settings-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function SettingsPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "admin");
  } catch {
    redirect("/dashboard");
  }

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );

  if (!retailer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-[var(--font-display)] text-[var(--color-stone-900)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Business profile and billing address. Slug, tier, subscription and
          currency are managed by PAON Admin.
        </p>
        <div className="mt-2 flex gap-4">
          <Link href="/settings/payments" className="text-sm underline">
            Payments settings →
          </Link>
          <Link href="/settings/billing" className="text-sm underline">
            Billing →
          </Link>
        </div>
      </div>
      <SettingsForm retailer={retailer} />
    </div>
  );
}
