import { AnalyticsRepository, RetailerRepository } from "@paon/database";
import { retailerRoleAtLeast, type CurrencyCode } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-stone-500)]">
        {label}
      </p>
      <p className="mt-2 text-3xl font-medium text-[var(--color-stone-900)]">
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--color-stone-500)]">{detail}</p>
    </Card>
  );
}

export default async function AnalyticsPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager"))
    redirect("/dashboard");

  const supabase = await getSupabaseServerClient();
  const retailer = await new RetailerRepository(supabase).findById(
    session.retailerId,
  );
  if (!retailer) notFound();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const summary = await new AnalyticsRepository(supabase).summary(
    session.retailerId,
    since.toISOString(),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-[var(--color-stone-500)]">Last 30 days</p>
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Business overview
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Revenue"
          value={formatMoney(
            {
              amountMinorUnits: summary.revenueMinorUnits,
              currency: retailer.defaultCurrency as CurrencyCode,
            },
            retailer.defaultLocale,
          )}
          detail="Paid and fulfilled order value"
        />
        <Metric
          label="Orders"
          value={String(summary.orders)}
          detail="Orders created"
        />
        <Metric
          label="Customers"
          value={String(summary.customers)}
          detail={`${summary.newCustomers} new relationships`}
        />
        <Metric
          label="Appointments"
          value={String(summary.appointments)}
          detail="Appointments in this period"
        />
        <Metric
          label="Open alterations"
          value={String(summary.openAlterations)}
          detail="Work still in progress"
        />
        <Metric
          label="Event attendance"
          value={String(summary.eventRsvps)}
          detail="Confirmed customer responses"
        />
        <Metric
          label="Messages"
          value={String(summary.messages)}
          detail="Customer and team messages"
        />
        <Metric
          label="Experience signals"
          value={String(summary.behavioralEvents)}
          detail="Captured interaction events"
        />
      </div>
    </div>
  );
}
