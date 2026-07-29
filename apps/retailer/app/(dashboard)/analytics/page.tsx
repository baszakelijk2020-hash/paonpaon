import {
  AnalyticsRepository,
  RetailerRepository,
  type RetailerAnalytics,
} from "@paon/database";
import { retailerRoleAtLeast, type CurrencyCode } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import { notFound, redirect } from "next/navigation";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function formatDelta(delta: number): string {
  if (delta === 0) return "flat vs prior 30 days";
  return `${delta > 0 ? "+" : ""}${delta} vs prior 30 days`;
}

function Metric({
  label,
  value,
  detail,
  delta,
}: {
  label: string;
  value: string;
  detail: string;
  delta?: string;
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
      {delta ? (
        <p className="mt-1 text-xs text-[var(--color-stone-400)]">{delta}</p>
      ) : null}
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

  const since30 = new Date();
  since30.setUTCDate(since30.getUTCDate() - 30);
  const since60 = new Date();
  since60.setUTCDate(since60.getUTCDate() - 60);

  const analyticsRepo = new AnalyticsRepository(supabase);
  const [summary, summary60] = await Promise.all([
    analyticsRepo.summary(session.retailerId, since30.toISOString()),
    analyticsRepo.summary(session.retailerId, since60.toISOString()),
  ]);

  // summary60 spans the last 60 days and summary spans the last 30, so
  // their difference is the 30-day window immediately before this one —
  // the "prior period" a delta needs, without a second date-range RPC.
  const priorPeriod: Omit<RetailerAnalytics, "customers" | "newCustomers"> = {
    orders: summary60.orders - summary.orders,
    revenueMinorUnits: summary60.revenueMinorUnits - summary.revenueMinorUnits,
    appointments: summary60.appointments - summary.appointments,
    openAlterations: summary60.openAlterations - summary.openAlterations,
    eventRsvps: summary60.eventRsvps - summary.eventRsvps,
    messages: summary60.messages - summary.messages,
    behavioralEvents: summary60.behavioralEvents - summary.behavioralEvents,
  };
  const newCustomersPrior = summary60.newCustomers - summary.newCustomers;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-[var(--color-stone-500)]">Last 30 days</p>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Performance
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
          delta={`${
            summary.revenueMinorUnits - priorPeriod.revenueMinorUnits >= 0
              ? "+"
              : ""
          }${formatMoney(
            {
              amountMinorUnits:
                summary.revenueMinorUnits - priorPeriod.revenueMinorUnits,
              currency: retailer.defaultCurrency as CurrencyCode,
            },
            retailer.defaultLocale,
          )} vs prior 30 days`}
        />
        <Metric
          label="Orders"
          value={String(summary.orders)}
          detail="Orders created"
          delta={formatDelta(summary.orders - priorPeriod.orders)}
        />
        <Metric
          label="Customers"
          value={String(summary.customers)}
          detail={`${summary.newCustomers} new relationships`}
          delta={formatDelta(summary.newCustomers - newCustomersPrior)}
        />
        <Metric
          label="Appointments"
          value={String(summary.appointments)}
          detail="Appointments in this period"
          delta={formatDelta(summary.appointments - priorPeriod.appointments)}
        />
        <Metric
          label="Open alterations"
          value={String(summary.openAlterations)}
          detail="Work still in progress"
          delta={formatDelta(
            summary.openAlterations - priorPeriod.openAlterations,
          )}
        />
        <Metric
          label="Event attendance"
          value={String(summary.eventRsvps)}
          detail="Confirmed customer responses"
          delta={formatDelta(summary.eventRsvps - priorPeriod.eventRsvps)}
        />
        <Metric
          label="Messages"
          value={String(summary.messages)}
          detail="Customer and team messages"
          delta={formatDelta(summary.messages - priorPeriod.messages)}
        />
        <Metric
          label="Experience signals"
          value={String(summary.behavioralEvents)}
          detail="Captured interaction events"
          delta={formatDelta(
            summary.behavioralEvents - priorPeriod.behavioralEvents,
          )}
        />
      </div>
    </div>
  );
}
