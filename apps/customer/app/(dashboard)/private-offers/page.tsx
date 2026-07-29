import { RetailerRepository } from "@paon/database";

import { loadPrivateOfferGroups } from "./actions";
import { ChallengePanel } from "./challenge-panel";
import { OffersPanel } from "./offers-panel";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function PrivateOffersPage() {
  const session = await requireSession();
  const groups = await loadPrivateOfferGroups(session.userId);
  const retailerRepo = new RetailerRepository(await getSupabaseServerClient());
  const groupsWithRetailers = await Promise.all(
    groups.map(async (group) => ({
      group,
      retailer: await retailerRepo.findById(group.retailerId),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Private offers
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Members-only offers and the seven-day wardrobe challenge. Eligibility
          follows personalization consent — never marketing consent.
        </p>
      </div>

      {groupsWithRetailers.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
        </div>
      ) : (
        groupsWithRetailers.map(({ group, retailer }) => (
          <div key={group.customerId} className="flex flex-col gap-6">
            <div>
              <h2 className="font-display text-xl text-[var(--color-stone-900)]">
                {retailer?.displayName ?? "Retailer"}
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-[var(--color-stone-500)]">
                {group.explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>

            <section aria-labelledby={`offers-${group.customerId}`}>
              <h3
                id={`offers-${group.customerId}`}
                className="font-display text-lg text-[var(--color-stone-900)]"
              >
                Private offers
              </h3>
              <div className="mt-3">
                <OffersPanel group={group} />
              </div>
            </section>

            <section aria-labelledby={`challenge-${group.customerId}`}>
              <h3
                id={`challenge-${group.customerId}`}
                className="font-display text-lg text-[var(--color-stone-900)]"
              >
                Seven-day wardrobe
              </h3>
              <div className="mt-3">
                <ChallengePanel group={group} />
              </div>
            </section>
          </div>
        ))
      )}
    </div>
  );
}
