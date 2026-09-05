import { CustomerFactRepository, CustomerRepository } from "@paon/database";
import { type CustomerFact } from "@paon/domain";

import { RelatedLinks } from "../related-links";

import { CorrectionForm } from "./correction-form";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

/** Facts a customer may see and correct themselves on this page.
 * Mirrors the eligibility gate `correct_own_customer_fact` itself
 * enforces (standard sensitivity, customer-visible, non-transactional)
 * — kept in sync deliberately rather than trusting the RPC to silently
 * reject a fact this page invited the customer to try to change. */
function isCustomerManaged(fact: CustomerFact): boolean {
  return (
    fact.visibility !== "advisor_only" &&
    fact.sensitivity === "standard" &&
    fact.provenanceClass !== "transactional"
  );
}

export default async function SelfPortraitPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();

  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const factRepo = new CustomerFactRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const facts = await factRepo.listForCustomer(
        customer.retailerId,
        customer.id,
      );
      return {
        customerId: customer.id,
        retailerId: customer.retailerId,
        facts: facts.filter(
          (fact) =>
            fact.visibility !== "advisor_only" &&
            fact.sensitivity === "standard",
        ),
      };
    }),
  );

  const hasAnyFacts = groups.some((group) => group.facts.length > 0);

  return (
    <div className="customer-page flex flex-col gap-8">
      <header className="customer-page-header flex-col">
        <p className="customer-kicker text-[var(--color-stone-500)]">
          Your Self-Portrait
        </p>
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl leading-[1.05] tracking-[-0.03em] text-[var(--color-stone-900)] sm:text-5xl">
            What we&apos;ve noted, in your words.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[var(--color-stone-500)]">
            Everything below is something an advisor observed or you told us —
            with where it came from. If anything is wrong, correct it here; we
            keep what was said and what you tell us is right, side by side.
          </p>
        </div>
        <RelatedLinks links={[{ href: "/account", label: "My Profile" }]} />
      </header>

      {!hasAnyFacts ? (
        <div className="customer-panel flex min-h-40 items-center px-6 py-10">
          <div>
            <p className="customer-kicker text-[var(--color-stone-500)]">
              Nothing here yet
            </p>
            <p className="mt-2 text-base text-[var(--color-stone-600)]">
              Once an advisor notes a preference, or you tell us one, it will
              show up here.
            </p>
          </div>
        </div>
      ) : (
        groups
          .filter((group) => group.facts.length > 0)
          .map((group) => (
            <section key={group.customerId} className="flex flex-col gap-3">
              <ul className="customer-panel flex flex-col divide-y divide-[var(--customer-border)]">
                {group.facts.map((fact) => (
                  <li
                    key={fact.id}
                    className="flex flex-col gap-2 px-6 py-4"
                    data-fact-id={fact.id}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs uppercase tracking-wide text-[var(--color-stone-500)]">
                        {fact.factType.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-[var(--color-stone-400)]">
                        {fact.provenanceClass === "customer_declared"
                          ? "From you"
                          : fact.provenanceClass === "advisor_observed"
                            ? "Noted by an advisor"
                            : "Inferred from your activity"}
                      </p>
                    </div>
                    <p className="text-base text-[var(--color-stone-900)]">
                      {fact.valueLabel}
                    </p>
                    {isCustomerManaged(fact) ? (
                      <CorrectionForm
                        factId={fact.id}
                        currentLabel={fact.valueLabel}
                      />
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}
