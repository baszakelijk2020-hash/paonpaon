import { SubscriptionPlanRepository } from "@paon/database";

import { PlanRow } from "./plan-row";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function BillingPlansPage() {
  await requireSession();
  const supabase = await getSupabaseServerClient();
  const repository = new SubscriptionPlanRepository(supabase);
  const [plans, features, managedServices] = await Promise.all([
    repository.findAll(),
    repository.findCommercialFeatures(),
    repository.findManagedServices(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-[var(--radius-xl)] bg-[var(--color-stone-900)] p-8 text-white shadow-[var(--shadow-elevated)] sm:p-11">
        <p className="text-[11px] font-[var(--font-accent)] uppercase tracking-[0.22em] text-white/60">
          Commercial catalogue
        </p>
        <h1 className="mt-4 max-w-3xl text-5xl font-[var(--font-display)] leading-none sm:text-6xl">
          Package the value. Keep the promise clear.
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-white/65">
          Edit recurring software, one-time implementation and included
          capabilities independently. Stripe Price IDs remain the live billing
          bridge; no plan is activated from display copy alone.
        </p>
      </section>
      <div className="flex flex-col gap-4">
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} features={features} />
        ))}
      </div>
      <section>
        <p className="text-[11px] font-[var(--font-accent)] uppercase tracking-[0.2em] text-[var(--color-stone-500)]">
          Optional human services
        </p>
        <h2 className="mt-2 text-4xl font-[var(--font-display)]">
          Managed services stay separate.
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-stone-500)]">
          These are proposal options, not hidden software entitlements or
          subscription charges.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {managedServices.map((service) => (
            <div
              key={service.id}
              className="rounded-[var(--radius-xl)] border bg-white p-6"
            >
              <h3 className="text-2xl font-[var(--font-display)]">
                {service.name}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-stone-500)]">
                {service.description}
              </p>
              <p className="mt-5 text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                Scoped per proposal
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
