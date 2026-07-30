import {
  AnalyticsRepository,
  ClientelingDashboardRepository,
  CustomerRepository,
  RetailerBranchRepository,
  RetailerRepository,
  type RetailerAnalytics,
} from "@paon/database";
import { retailerRoleAtLeast, type CurrencyCode } from "@paon/domain";
import { Card } from "@paon/ui/components/Card";
import { formatMoney } from "@paon/utils";
import Link from "next/link";
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
  const defaultBranch = await new RetailerBranchRepository(
    supabase,
  ).findDefault(session.retailerId);
  const [summary, summary60, clienteling, customers] = await Promise.all([
    analyticsRepo.summary(session.retailerId, since30.toISOString()),
    analyticsRepo.summary(session.retailerId, since60.toISOString()),
    new ClientelingDashboardRepository(supabase).projectForRetailer({
      retailerId: session.retailerId,
      ...(defaultBranch ? { timezone: defaultBranch.timezone } : {}),
    }),
    new CustomerRepository(supabase).findByRetailer(session.retailerId),
  ]);

  const customerNameById = Object.fromEntries(
    customers.map((customer) => [customer.id, customer.fullName]),
  );

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
  const maxHeat = Math.max(
    1,
    ...clienteling.hourlyHeatmap.map((cell) => cell.count),
  );
  const funnel = clienteling.opportunityFunnel;
  const outcomes = clienteling.outcomeFunnel;
  const ttlSeconds = Math.round(clienteling.presenceTtlMs / 1000);

  return (
    <div className="flex flex-col gap-8">
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
          label="Opportunity drafts"
          value={String(funnel.draft)}
          detail={`${funnel.accepted} accepted · ${funnel.completed} completed · not raw event volume`}
        />
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Clienteling intelligence
          </p>
          <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
            Presence, funnel, and demand hours
          </h2>
          <p className="mt-1 text-sm text-[var(--color-stone-500)]">
            Active only within a {ttlSeconds}s heartbeat TTL. After that we show
            last seen — never implied online. Heatmap uses{" "}
            {defaultBranch?.timezone ?? "UTC"}.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
              Signed-in presence
            </h3>
            {clienteling.presence.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--color-stone-500)]">
                No recent authenticated sessions in the last day.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {clienteling.presence.slice(0, 12).map((row) => (
                  <li
                    key={row.customerId}
                    className="flex items-center justify-between gap-3"
                  >
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {customerNameById[row.customerId] ?? "Customer"}
                    </Link>
                    <span
                      className={
                        row.status === "active"
                          ? "text-[var(--color-stone-900)]"
                          : "text-[var(--color-stone-500)]"
                      }
                    >
                      {row.status === "active"
                        ? "Active now"
                        : `Last seen ${new Date(row.lastSeenAt).toLocaleString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
              Opportunity funnel
            </h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Draft", funnel.draft],
                  ["Contact pressure", funnel.contactPressureDrafts],
                  ["Accepted", funnel.accepted],
                  ["Completed", funnel.completed],
                  ["Snoozed", funnel.snoozed],
                  ["Dismissed", funnel.dismissed],
                  ["Incorrect", funnel.incorrect],
                  ["Expired", funnel.expired],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[var(--color-stone-500)]">{label}</dt>
                  <dd className="font-display text-2xl text-[var(--color-stone-900)]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
              Outcome funnel
            </h3>
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              Completed touches linked to message, appointment, sale, or honest
              no-response.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Message", outcomes.message],
                  ["Appointment", outcomes.appointment],
                  ["Sale", outcomes.sale],
                  ["No response", outcomes.noResponse],
                  ["Pending", outcomes.pending],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[var(--color-stone-500)]">{label}</dt>
                  <dd className="font-display text-2xl text-[var(--color-stone-900)]">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <Card>
          <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
            Hourly demand heatmap (7 days)
          </h3>
          <div className="mt-4 flex flex-wrap gap-1">
            {clienteling.hourlyHeatmap.map((cell) => (
              <div
                key={cell.hour}
                className="flex w-6 flex-col items-center gap-1 sm:w-7"
              >
                <div
                  title={`${cell.hour}:00 · ${cell.count}`}
                  className="h-10 w-full rounded-sm bg-[var(--color-stone-900)]"
                  style={{
                    opacity: 0.08 + (0.92 * cell.count) / maxHeat,
                  }}
                />
                <span className="text-[9px] text-[var(--color-stone-400)]">
                  {cell.hour}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
