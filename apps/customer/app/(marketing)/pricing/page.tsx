import { SubscriptionPlanRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatMoney } from "@paon/utils";
import Link from "next/link";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function PricingPage() {
  const repository = new SubscriptionPlanRepository(
    await getSupabaseServerClient(),
  );
  const [plans, features, services] = await Promise.all([
    repository.findAll(),
    repository.findCommercialFeatures(),
    repository.findManagedServices(),
  ]);
  const publicPlans = plans.filter((plan) => plan.isPublic);

  return (
    <main className="px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
      <section className="mx-auto max-w-[92rem]">
        <p className="text-[10px] font-[var(--font-accent)] uppercase tracking-[0.22em] text-black/45">
          PAON packages
        </p>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
          <h1 className="text-6xl font-[var(--font-display)] leading-[0.9] sm:text-8xl">
            Start clearly.
            <br />
            Grow deliberately.
          </h1>
          <p className="max-w-xl text-base leading-8 text-black/55">
            Software subscription, implementation and optional managed services
            are always presented separately. Every proposal can refine scope
            without hiding what is recurring.
          </p>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-[92rem] gap-5 lg:grid-cols-3">
        {publicPlans.map((plan, index) => (
          <article
            key={plan.id}
            className={`flex flex-col rounded-[1.25rem] border p-7 sm:p-9 ${
              index === 1
                ? "border-[#1a1a1a] bg-[#1a1a1a] text-white shadow-[var(--shadow-elevated)]"
                : "border-black/10 bg-white"
            }`}
          >
            <p className="text-xs opacity-55">{plan.name}</p>
            <p className="mt-7 text-5xl font-[var(--font-display)]">
              {plan.priceIsFrom ? "From " : ""}
              {formatMoney(plan.price, "en-US")}
            </p>
            <p className="mt-1 text-xs opacity-50">per month</p>
            <h2 className="mt-9 text-3xl font-[var(--font-display)] leading-tight">
              {plan.positioning}
            </h2>
            <p className="mt-4 text-sm leading-6 opacity-60">
              {plan.description}
            </p>
            <div className="border-current/15 mt-8 border-t pt-6">
              <p className="text-xs opacity-45">Implementation</p>
              <p className="mt-1 text-lg">
                {plan.priceIsFrom ? "From " : ""}
                {formatMoney(plan.implementationFee, "en-US")}
              </p>
            </div>
            <ul className="mt-8 flex-1 space-y-3 text-sm">
              {features
                .filter((feature) =>
                  plan.includedFeatureKeys.includes(feature.key),
                )
                .map((feature) => (
                  <li key={feature.key} className="flex gap-3">
                    <span aria-hidden="true">—</span>
                    {feature.name}
                  </li>
                ))}
            </ul>
            <Link
              href={`/demo-request?plan=${plan.key}`}
              className={buttonVariants({
                variant: index === 1 ? "secondary" : "primary",
                size: "lg",
                className: "mt-9 w-full",
              })}
            >
              View this package in your brand
            </Link>
          </article>
        ))}
      </section>

      <section className="mx-auto mt-24 max-w-[92rem] border-t border-black/15 pt-16">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
              Optional managed growth
            </p>
            <h2 className="mt-4 text-5xl font-[var(--font-display)] leading-none">
              Human partnership,
              <br />
              scoped honestly.
            </h2>
          </div>
          <div className="divide-y divide-black/15">
            {services
              .filter((service) => service.isPublic)
              .map((service) => (
                <div key={service.id} className="py-6">
                  <h3 className="text-2xl font-[var(--font-display)]">
                    {service.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-black/50">
                    {service.description} Scoped and priced in the retailer’s
                    proposal.
                  </p>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-[92rem] rounded-[1.25rem] bg-[#1a1a1a] p-8 text-white sm:p-12">
        <h2 className="max-w-3xl text-5xl font-[var(--font-display)] leading-none sm:text-7xl">
          Begin with a paid pilot built around one real retailer objective.
        </h2>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            href="/pilot"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Start a paid pilot
          </Link>
          <Link
            href="/consultation"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "border-white/35 text-white hover:bg-white/10",
            })}
          >
            Book a retailer consultation
          </Link>
        </div>
      </section>
    </main>
  );
}
