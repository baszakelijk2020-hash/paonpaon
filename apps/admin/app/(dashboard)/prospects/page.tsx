import { CommercialProspectRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import Link from "next/link";

import { getSupabaseServerClient } from "@/lib/supabase-server";

const STAGE_LABELS = {
  researched: "Research",
  qualified: "Qualified",
  demo_preparation: "Demo in preparation",
  demo_ready: "Demo ready",
  demo_sent: "Demo sent",
  consultation: "Consultation",
  proposal: "Proposal",
  pilot: "Paid pilot",
  converted: "Converted",
  lost: "Closed",
} as const;

export default async function ProspectsPage() {
  const prospects = await new CommercialProspectRepository(
    await getSupabaseServerClient(),
  ).list();
  const overdue = prospects.filter(
    (prospect) =>
      prospect.nextActionDueAt &&
      new Date(prospect.nextActionDueAt).getTime() < Date.now() &&
      !["converted", "lost"].includes(prospect.stage),
  );

  return (
    <div className="space-y-10">
      <section className="rounded-[1.25rem] bg-stone-900 p-7 text-white sm:p-10">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          Founder commercial studio
        </p>
        <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-5xl leading-none sm:text-7xl">
              Make the next conversation specific.
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
          ["Active prospects", prospects.length],
          [
            "Waiting for demo",
            prospects.filter((item) =>
              ["qualified", "demo_preparation"].includes(item.stage),
            ).length,
          ],
          ["Follow-ups overdue", overdue.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1.25rem] border bg-white p-6">
            <p className="text-xs text-stone-500">{label}</p>
            <p className="font-display mt-3 text-4xl">{value}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
              Personalized environments
            </p>
            <h2 className="font-display mt-2 text-3xl">Prospect workbench</h2>
          </div>
        </div>
        {prospects.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {prospects.map((prospect) => (
              <Link
                href={`/prospects/${prospect.id}/studio`}
                key={prospect.id}
                className="rounded-[1.25rem] border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lifted)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-stone-500">
                      {STAGE_LABELS[prospect.stage]}
                    </p>
                    <h3 className="font-display mt-2 text-3xl">
                      {prospect.companyName}
                    </h3>
                    <p className="mt-2 text-sm text-stone-500">
                      {prospect.primaryContactName} ·{" "}
                      {prospect.primaryContactEmail}
                    </p>
                  </div>
                  <span className="text-xl">→</span>
                </div>
                <div className="mt-6 border-t pt-4">
                  <p className="text-xs text-stone-500">Next action</p>
                  <p className="mt-1 text-sm">
                    {prospect.nextAction ?? "Define the next commercial action"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-dashed p-10 text-center">
            <h3 className="font-display text-3xl">
              Start with one deliberately chosen retailer.
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-stone-500">
              Capture the brand and customer-experience hypothesis before
              configuring a demo. No scraped customer records belong here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
