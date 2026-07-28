import { SubscriptionPlanRepository } from "@paon/database";
import { buttonVariants } from "@paon/ui/components/Button";
import { formatMoney } from "@paon/utils";
import Link from "next/link";

import { ExperiencePreview } from "./experience-preview";

import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MarketingHomePage() {
  const repository = new SubscriptionPlanRepository(
    await getSupabaseServerClient(),
  );
  const plans = (await repository.findAll()).filter((plan) => plan.isPublic);

  return (
    <main>
      <section className="relative isolate min-h-[52rem] overflow-hidden bg-[#1a1a1a] px-5 pb-16 pt-36 text-white sm:px-8">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-[center_30%] opacity-55"
          style={{
            backgroundImage:
              "url(https://www.nebelspiegel.com/images/smaller/6088.webp)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/75 to-black/20"
        />
        <div className="mx-auto flex min-h-[40rem] max-w-[92rem] flex-col justify-between">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.24em] text-white/55">
            <span className="h-px w-9 bg-white/50" />
            Premium retail, connected
          </div>
          <div className="max-w-5xl">
            <h1 className="font-display text-[clamp(4rem,9vw,9rem)] leading-[0.82] tracking-[-0.04em]">
              The relationship
              <br />
              is the product.
            </h1>
            <div className="mt-9 flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <p className="max-w-xl text-sm leading-7 text-white/65 sm:text-base">
                PAON gives premium retailers one composed customer and operating
                platform—from first discovery to fitting, workroom, delivery and
                the next reason to return.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/demo-request"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  View a personalized demonstration
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
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[92rem]">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <div>
              <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-black/45">
                A product people can feel
              </p>
              <h2 className="font-display mt-5 text-5xl leading-[0.95] sm:text-7xl">
                Calm on the surface.
                <br />
                Deep underneath.
              </h2>
            </div>
            <p className="max-w-2xl text-base leading-8 text-black/55">
              Client history, appointments, commerce, alteration evidence,
              workshop handoffs and advisor conversations remain connected.
              Every role sees the next useful decision—not an enterprise
              dashboard full of everything.
            </p>
          </div>
          <div className="mt-14">
            <ExperiencePreview />
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-[#f4f1ec] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-[42rem] text-center">
          <p className="font-display text-2xl leading-snug tracking-[-0.02em] text-[#111110] sm:text-3xl">
            I&apos;m not building software for the menswear industry. I&apos;m
            building the platform I always wished I&apos;d had.
          </p>
          <p className="mt-6 text-sm leading-7 text-black/50">
            Built by someone who measured clients, ran fittings, and lived the
            admin that gets in the way.
          </p>
          <Link
            href="/founder"
            className="mt-8 inline-block text-sm underline underline-offset-4"
          >
            Read why I built this →
          </Link>
        </div>
      </section>

      <section className="bg-[#e8e4de] px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto grid max-w-[92rem] gap-5 lg:grid-cols-12">
          <article className="relative min-h-[38rem] overflow-hidden rounded-[1.25rem] bg-black text-white lg:col-span-7">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-center opacity-60"
              style={{
                backgroundImage:
                  "url(https://www.nebelspiegel.com/images/smaller/6071.webp)",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 sm:p-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/55">
                Private-client experience
              </p>
              <h2 className="font-display mt-4 max-w-xl text-5xl leading-none">
                Luxury does not end at checkout.
              </h2>
              <p className="mt-5 max-w-xl text-sm leading-6 text-white/65">
                Customers see appointments, pieces, garment progress,
                recognition and one continuous advisor relationship.
              </p>
              <Link
                href="/discover/engagement"
                className="mt-6 inline-flex text-sm underline underline-offset-4"
              >
                Explore customer engagement →
              </Link>
            </div>
          </article>
          <div className="grid gap-5 lg:col-span-5">
            <article className="rounded-[1.25rem] bg-[#1a1a1a] p-8 text-white sm:p-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                Alteration operations
              </p>
              <p className="font-display mt-12 text-7xl">62%</p>
              <div className="mt-5 h-1 bg-white/15">
                <div className="h-full w-[62%] bg-white" />
              </div>
              <h3 className="font-display mt-8 text-3xl">
                From fitting observation to confident handoff.
              </h3>
              <Link
                href="/discover/alterations"
                className="mt-5 inline-flex text-sm text-white/65 underline underline-offset-4"
              >
                Follow a garment journey →
              </Link>
            </article>
            <article className="rounded-[1.25rem] border border-black/10 bg-white p-8 sm:p-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
                Retailer outcomes
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4">
                <div>
                  <p className="font-display text-4xl">1</p>
                  <p className="mt-1 text-xs text-black/45">client view</p>
                </div>
                <div>
                  <p className="font-display text-4xl">8</p>
                  <p className="mt-1 text-xs text-black/45">role lenses</p>
                </div>
                <div>
                  <p className="font-display text-4xl">Now</p>
                  <p className="mt-1 text-xs text-black/45">next action</p>
                </div>
              </div>
              <Link
                href="/discover/outcomes"
                className="mt-8 inline-flex text-sm text-black/55 underline underline-offset-4"
              >
                See retailer outcomes →
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[92rem]">
          <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-black/45">
            Built around the people doing the work
          </p>
          <div className="mt-5 grid gap-10 lg:grid-cols-2">
            <h2 className="font-display text-6xl leading-[0.95] sm:text-8xl">
              One house.
              <br />
              Eight clear views.
            </h2>
            <div className="divide-y divide-black/15">
              {[
                ["Owner", "Commercial health and decisions needing approval"],
                ["Manager", "Today’s service promises and operating pressure"],
                ["Advisor", "Client context, appointments and follow-through"],
                ["Operations", "Orders and garments that must advance"],
                ["Workshop", "Approved work, evidence, due dates and review"],
                ["Customer", "A luxurious, continuous private-client world"],
              ].map(([role, value]) => (
                <div
                  key={role}
                  className="grid grid-cols-[8rem_1fr] gap-4 py-5"
                >
                  <p className="font-medium">{role}</p>
                  <p className="text-sm leading-6 text-black/50">{value}</p>
                </div>
              ))}
              <div className="pt-5">
                <Link
                  href="/discover/roles"
                  className="text-sm text-black/55 underline underline-offset-4"
                >
                  Explore every role lens →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#1a1a1a] px-5 py-24 text-white sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[92rem]">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="font-accent text-[10px] uppercase tracking-[0.22em] text-white/45">
                A clear way to begin
              </p>
              <h2 className="font-display mt-5 text-6xl leading-none sm:text-8xl">
                Choose the canvas.
              </h2>
            </div>
            <Link
              href="/pricing"
              className="text-sm underline underline-offset-4"
            >
              Compare every capability →
            </Link>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[1.25rem] bg-white/15 lg:grid-cols-3">
            {plans.map((plan) => (
              <article key={plan.id} className="bg-[#1a1a1a] p-7 sm:p-9">
                <p className="text-xs text-white/45">{plan.name}</p>
                <p className="font-display mt-6 text-4xl">
                  {plan.priceIsFrom ? "From " : ""}
                  {formatMoney(plan.price, "en-US")}
                </p>
                <p className="text-xs text-white/45">per month</p>
                <h3 className="font-display mt-8 text-2xl">
                  {plan.positioning}
                </h3>
                <p className="mt-4 text-sm leading-6 text-white/50">
                  {plan.includedFeatureKeys.length} included capabilities ·{" "}
                  {plan.priceIsFrom ? "from " : ""}
                  {formatMoney(plan.implementationFee, "en-US")} implementation
                </p>
              </article>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/pilot"
              className={buttonVariants({
                variant: "secondary",
                size: "lg",
              })}
            >
              Start a paid pilot
            </Link>
            <Link
              href="/demo-request"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "border-white/35 text-white hover:bg-white/10",
              })}
            >
              See PAON in your brand
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
