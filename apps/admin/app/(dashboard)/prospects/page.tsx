import { CommercialProspectRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";

import { ProspectsWorkbench } from "./prospects-workbench";

import { env } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ProspectsPage() {
  const customerBase = (env.customerAppUrl ?? "").replace(/\/$/, "");
  const rows = await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).listWithDemoSummaries();
  const overdue = rows.filter(
    ({ prospect }) =>
      prospect.nextActionDueAt &&
      new Date(prospect.nextActionDueAt).getTime() < Date.now() &&
      !["converted", "lost"].includes(prospect.stage),
  );

  return (
    <div className="space-y-10">
      <section className="rounded-[var(--radius-md)] bg-[var(--color-stone-900)] p-7 text-white sm:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          Founder commercial studio
        </p>
        <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-5xl leading-none sm:text-7xl">
              Demo Studio
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
              Research, brand configuration and demo scope stay connected before
              any isolated synthetic environment is generated.
            </p>
          </div>
          <Link
            href="/prospects/new"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Create prospect
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Active prospects", rows.length],
          [
            "Waiting for demo",
            rows.filter(({ prospect }) =>
              ["qualified", "demo_preparation"].includes(prospect.stage),
            ).length,
          ],
          ["Follow-ups overdue", overdue.length],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--radius-md)] border bg-white p-6"
          >
            <p className="text-xs text-[var(--color-stone-500)]">{label}</p>
            <p className="font-display mt-3 text-4xl">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-stone-500)]">
            Personalized environments
          </p>
          <h2 className="font-display mt-2 text-3xl">Prospect workbench</h2>
        </div>
        {rows.length ? (
          <ProspectsWorkbench
            rows={rows.map(({ prospect, demo }) => {
              const storefrontHref = demo?.retailerSlug
                ? customerBase
                  ? `${customerBase}/r/${demo.retailerSlug}`
                  : `/r/${demo.retailerSlug}`
                : null;
              const privateDemoHref = demo
                ? customerBase
                  ? `${customerBase}/demo/${demo.publicToken}`
                  : `/demo/${demo.publicToken}`
                : null;
              return {
                id: prospect.id,
                companyName: prospect.companyName,
                primaryContactName: prospect.primaryContactName,
                primaryContactEmail: prospect.primaryContactEmail,
                stage: prospect.stage,
                nextAction: prospect.nextAction ?? null,
                demoStatus: demo?.status ?? null,
                retailerSlug: demo?.retailerSlug ?? null,
                storefrontHref,
                privateDemoHref,
              };
            })}
          />
        ) : (
          <div className="rounded-[var(--radius-md)] border border-dashed p-10 text-center">
            <h3 className="font-display text-3xl">
              Start with one deliberately chosen retailer.
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--color-stone-500)]">
              Capture the research, configure their brand and generate a
              retailer-specific demonstration before the first call.
            </p>
            <Link
              href="/prospects/new"
              className={buttonVariants({ className: "mt-6" })}
            >
              Create prospect
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
