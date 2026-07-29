import { AnalyticsRepository } from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import { formatDate } from "@paon/utils";

import { ExportCsvButton } from "./export-csv-button";

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

export default async function PlatformAnalyticsPage() {
  await requireSession();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const supabase = await getSupabaseServerClient();
  const summary = await new AnalyticsRepository(supabase).platformSummary(
    since.toISOString(),
  );
  const gmv =
    Object.entries(summary.grossMerchandiseValueByCurrency)
      .map(
        ([currency, amount]) =>
          `${currency} ${(amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
      )
      .join(" · ") || "—";
  const now = new Date();
  const csvRows: [string, string][] = [
    ["Retailers", String(summary.retailers)],
    ["Active retailers", String(summary.activeRetailers)],
    ["New retailers", String(summary.newRetailers)],
    ["Customers", String(summary.customers)],
    ["New customers", String(summary.newCustomers)],
    ["Orders", String(summary.orders)],
    ["GMV", gmv],
    ["Appointments", String(summary.appointments)],
    ["Open alterations", String(summary.openAlterations)],
    ["Messages", String(summary.messages)],
    ["Experience signals", String(summary.behavioralEvents)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--color-stone-500)]">
            {formatDate(since.toISOString(), "en-US")} –{" "}
            {formatDate(now.toISOString(), "en-US")} (rolling 30 days, refreshed
            on every visit — not a fixed reporting period)
          </p>
          <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
            Analytics
          </h1>
        </div>
        <ExportCsvButton
          rows={csvRows}
          since={since.toISOString().slice(0, 10)}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Retailers"
          value={String(summary.retailers)}
          detail={`${summary.activeRetailers} active · ${summary.newRetailers} new`}
        />
        <Metric
          label="Customers"
          value={String(summary.customers)}
          detail={`${summary.newCustomers} new relationships`}
        />
        <Metric
          label="Orders"
          value={String(summary.orders)}
          detail="Orders created across PAON"
        />
        <Metric
          label="GMV"
          value={gmv}
          detail="Separated by currency; no false conversion"
        />
        <Metric
          label="Appointments"
          value={String(summary.appointments)}
          detail="Appointments created"
        />
        <Metric
          label="Open alterations"
          value={String(summary.openAlterations)}
          detail="Active work across retailers"
        />
        <Metric
          label="Messages"
          value={String(summary.messages)}
          detail="Customer and retailer messages"
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
