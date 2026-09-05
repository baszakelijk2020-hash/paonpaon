import {
  CustomerRepository,
  ForYouRepository,
  RetailerRepository,
} from "@paon/database";
import { Card } from "@paon/ui/components/Card";
import Link from "next/link";

import { recordForYouFeedback } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function ForYouPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
  const retailerRepo = new RetailerRepository(supabase);
  const forYouRepo = new ForYouRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailer = await retailerRepo.findById(customer.retailerId);
      const projection = await forYouRepo.projectForCustomer({
        retailerId: customer.retailerId,
        customerId: customer.id,
      });
      return { customer, retailer, projection };
    }),
  );

  const visibleGroups = groups.flatMap((group) =>
    group.retailer && group.projection.items.length > 0
      ? [{ ...group, retailer: group.retailer }]
      : [],
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          For You
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-stone-500)]">
          Deterministic picks from your quiz answers, saves, Tie-Mate, wardrobe
          gaps, advisor notes, occasions, and recent browsing — each with a
          reason you can verify or correct.
        </p>
      </div>

      {visibleGroups.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-stone-600)]">
            Nothing ranked yet. Take the sixty-second style quiz, grant
            personalization consent, save pieces, or browse the house catalogue
            — For You stays empty rather than invent recommendations.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              href="/style-quiz"
              className="font-medium underline underline-offset-2"
            >
              Take the style quiz
            </Link>
            <Link href="/wishlist" className="underline">
              Open saved
            </Link>
            <Link href="/account" className="underline">
              Review consent
            </Link>
          </div>
        </Card>
      ) : (
        visibleGroups.map((group) => {
          const retailer = group.retailer;
          return (
            <section key={group.customer.id} className="flex flex-col gap-4">
              <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
                {retailer.displayName}
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2">
                {group.projection.items.map((item) => (
                  <li key={item.productId}>
                    <Card>
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-stone-500)]">
                        {item.primaryReason}
                      </p>
                      <h3 className="font-display mt-2 text-xl text-[var(--color-stone-900)]">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                        {item.reasonCopy.join(" · ")}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/r/${retailer.slug}/products/${item.productSlug ?? item.productId}`}
                          className="rounded-[var(--radius-sm)] border border-[var(--color-stone-900)] bg-[var(--color-stone-900)] px-3 py-1.5 text-xs text-white"
                        >
                          View
                        </Link>
                        {(
                          [
                            ["for_you_clicked", "Useful"],
                            ["for_you_dismissed", "Dismiss"],
                            ["for_you_corrected", "Incorrect"],
                          ] as const
                        ).map(([eventName, label]) => (
                          <form key={eventName} action={recordForYouFeedback}>
                            <input
                              type="hidden"
                              name="eventName"
                              value={eventName}
                            />
                            <input
                              type="hidden"
                              name="productId"
                              value={item.productId}
                            />
                            <input
                              type="hidden"
                              name="retailerId"
                              value={group.customer.retailerId}
                            />
                            <input
                              type="hidden"
                              name="customerId"
                              value={group.customer.id}
                            />
                            <button
                              type="submit"
                              className="rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 py-1.5 text-xs"
                            >
                              {label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
