import { AnalyticsRepository, RetailerRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { RetailersNetworkList } from "./retailers-network-list";

import { getSupabaseServerClient } from "@/lib/supabase-server";

function sinceThirtyDaysAgo(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 30);
  return date.toISOString();
}

export default async function RetailersPage() {
  const supabase = await getSupabaseServerClient();
  const [retailers, analytics] = await Promise.all([
    new RetailerRepository(supabase).list(),
    new AnalyticsRepository(supabase).platformSummary(sinceThirtyDaysAgo()),
  ]);
  const attentionRetailers = retailers.filter(
    (retailer) => retailer.status !== "active",
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="relative isolate overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-stone-900)] px-7 py-9 text-white shadow-[var(--shadow-elevated)] sm:px-11 sm:py-12">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-40 -z-10 h-96 w-96 rounded-full border border-white/10 bg-white/5"
        />
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-3xl">
            <p className="font-accent text-[11px] uppercase tracking-[0.24em] text-white/60">
              Platform morning brief
            </p>
            <h1 className="font-display mt-4 text-5xl leading-[0.96] sm:text-7xl">
              The network,
              <br />
              clearly in view.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/65">
              See adoption, service pressure and the retailers that need a human
              response before they become a platform issue.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/retailers/new"
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
              })}
            >
              Onboard a retailer
            </Link>
            <Link
              href="/demo-mode"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/35 text-white hover:bg-white/10",
              })}
            >
              Open seed data
            </Link>
          </div>
        </div>
      </section>

      <section
        aria-label="Analytics"
        className="grid grid-cols-2 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-stone-200)] bg-white shadow-[var(--shadow-lifted)] lg:grid-cols-4"
      >
        {[
          {
            value: analytics.activeRetailers,
            label: "Active retailers",
          },
          { value: analytics.customers, label: "Known clients" },
          { value: analytics.orders, label: "Orders · 30 days" },
          {
            value: analytics.openAlterations,
            label: "Open garments",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="border-b border-r border-[var(--color-stone-200)] px-5 py-5 sm:px-6"
          >
            <p className="font-display text-4xl">{metric.value}</p>
            <p className="mt-1 text-xs text-[var(--color-stone-500)]">
              {metric.label}
            </p>
          </div>
        ))}
      </section>

      {attentionRetailers.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
                Intervention
              </p>
              <h2 className="font-display text-3xl">
                Needs platform attention
              </h2>
            </div>
            <span className="rounded-[var(--radius-md)] bg-[var(--color-warning-500)] px-3 py-1 text-xs">
              {attentionRetailers.length}
            </span>
          </div>
          <div className="grid gap-3">
            {attentionRetailers.map((retailer) => (
              <Link key={retailer.id} href={`/retailers/${retailer.id}`}>
                <Card className="flex flex-col justify-between gap-4 border-l-4 border-l-[var(--color-warning-500)] sm:flex-row sm:items-center">
                  <div>
                    <p className="font-medium">{retailer.displayName}</p>
                    <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                      Account is {retailer.status}. Review access, subscription
                      and owner readiness.
                    </p>
                  </div>
                  <span className="text-sm">Review account →</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <Card className="border-dashed text-center">
          <p className="font-display text-2xl">The network is healthy.</p>
          <p className="mt-2 text-sm text-[var(--color-stone-500)]">
            Every retailer is active. Platform attention can stay focused on
            adoption and growth.
          </p>
        </Card>
      )}

      <section>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-accent text-[11px] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
              Retailer network
            </p>
            <h2 className="font-display text-4xl">
              {retailers.length} operating house
              {retailers.length === 1 ? "" : "s"}
            </h2>
          </div>
          <Link
            href="/analytics"
            className={buttonVariants({ variant: "outline" })}
          >
            Explore platform signals
          </Link>
        </div>

        {retailers.length === 0 ? (
          <Card className="border-dashed py-14 text-center">
            <p className="font-display text-3xl">
              Build the first relationship.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-stone-500)]">
              Onboarding creates the retailer workspace and invites its owner
              into a guided, testable operating environment.
            </p>
            <Link
              href="/retailers/new"
              className={buttonVariants({ className: "mt-5" })}
            >
              Onboard first retailer
            </Link>
          </Card>
        ) : (
          <RetailersNetworkList
            retailers={retailers.map((retailer) => ({
              id: retailer.id,
              displayName: retailer.displayName,
              slug: retailer.slug,
              status: retailer.status,
              tier: retailer.tier,
              defaultLocale: retailer.defaultLocale,
              createdAt: retailer.createdAt,
            }))}
          />
        )}
      </section>
    </div>
  );
}
