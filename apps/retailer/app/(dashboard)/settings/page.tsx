import { requireRetailerRole } from "@paon/auth";
import {
  AvailabilityWindowRepository,
  RetailerRepository,
  RetailerStaffRepository,
  RetailerStripeAccountRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
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

  const [stripeAccount, staff, availability] = await Promise.all([
    new RetailerStripeAccountRepository(supabase).findByRetailer(
      session.retailerId,
    ),
    new RetailerStaffRepository(supabase).findByRetailer(session.retailerId),
    new AvailabilityWindowRepository(supabase).findByRetailer(
      session.retailerId,
    ),
  ]);

  const brandReady = Boolean(
    retailer.brandTheme.logoUrl || retailer.brandTheme.heroImageUrl,
  );
  const paymentsReady = Boolean(stripeAccount?.chargesEnabled);
  const teamReady = staff.some((member) => member.acceptedAt);
  const hoursReady = availability.length > 0;

  const checklist = [
    {
      label: "Brand",
      detail: brandReady ? "Logo or theme set" : "Add logo and brand colours",
      href: "/settings/brand",
      done: brandReady,
    },
    {
      label: "Payments",
      detail: paymentsReady
        ? "Charges enabled"
        : "Connect Stripe to take online payment",
      href: "/settings/payments",
      done: paymentsReady,
    },
    {
      label: "Team",
      detail: teamReady
        ? `${staff.filter((m) => m.acceptedAt).length} active`
        : "Invite at least one teammate",
      href: "/staff",
      done: teamReady,
    },
    {
      label: "Hours",
      detail: hoursReady
        ? `${availability.length} availability window${availability.length === 1 ? "" : "s"}`
        : "Set appointment availability",
      href: "/appointments/availability",
      done: hoursReady,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Business profile and billing address. Slug, tier, subscription and
          currency are managed by PAON Admin.
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/settings/brand" className="text-sm underline">
            Brand configuration →
          </Link>
          <Link href="/settings/payments" className="text-sm underline">
            Payments settings →
          </Link>
          <Link href="/settings/billing" className="text-sm underline">
            Billing →
          </Link>
          <Link href="/settings/integrations" className="text-sm underline">
            Source connections →
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-stone-100)] px-5 py-4">
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Store readiness
          </p>
          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
            Four checks before a prospect or client judges the house ready.
          </p>
        </div>
        <ul className="divide-y divide-[var(--color-stone-100)]">
          {checklist.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[var(--color-stone-50)]"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {item.label}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {item.detail}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs uppercase tracking-wide ${
                    item.done
                      ? "text-[var(--color-success-500)]"
                      : "text-[var(--color-warning-500)]"
                  }`}
                >
                  {item.done ? "Ready" : "Todo"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <SettingsForm retailer={retailer} />
    </div>
  );
}
