import {
  CustomerRepository,
  LoyaltyRepository,
  RetailerRepository,
} from "@paon/database";
import {
  LOYALTY_TIER_LABELS,
  milestonePresentation,
  REFERRAL_STATUS_LABELS,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";

import { RelatedLinks } from "../related-links";

import { inviteFriend, joinLoyalty, redeemReward } from "./actions";
import { BadgesShelf } from "./badges-shelf";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TIER_TONE = {
  member: "neutral",
  silver: "neutral",
  gold: "warning",
  platinum: "success",
} as const;

const REFERRAL_TONE = {
  invited: "neutral",
  signed_up: "warning",
  first_purchase_completed: "success",
  rewarded: "success",
} as const;

export default async function LoyaltyPage() {
  const session = await requireSession();
  const client = await getSupabaseServerClient();
  const customers = await new CustomerRepository(client).findByUserId(
    session.userId,
  );
  const loyalty = new LoyaltyRepository(client);
  const retailers = new RetailerRepository(client);
  const relationships = await Promise.all(
    customers.map(async (customer) => ({
      customer,
      retailer: await retailers.findById(customer.retailerId),
      account: await loyalty.findAccountByCustomer(customer.id),
      rewards: await loyalty.findRewards(customer.retailerId),
      referrals: await loyalty.findReferrals(customer.id),
      milestones: await loyalty.findMilestoneAwardsForCustomer(customer.id),
    })),
  );
  return (
    <div className="customer-page flex flex-col gap-6">
      <header className="customer-page-header flex-col items-start gap-2">
        <h1 className="font-display text-4xl text-[var(--customer-ink)]">
          Loyalty &amp; rewards
        </h1>
        <p className="max-w-2xl text-base text-[var(--color-stone-600)]">
          Membership, considered milestones, and referrals across your
          retailers.
        </p>
        <RelatedLinks
          links={[{ href: "/private-offers", label: "Private Offers" }]}
        />
      </header>
      {relationships.map(
        (
          { customer, retailer, account, rewards, referrals, milestones },
          index,
        ) => (
          <section
            key={customer.id}
            className="customer-panel paon-reveal flex flex-col gap-5 p-5"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                  {retailer?.displayName ?? "Retailer"}
                </p>
                {account ? (
                  <Badge tone={TIER_TONE[account.tier]} className="mt-1">
                    {LOYALTY_TIER_LABELS[account.tier]}
                  </Badge>
                ) : (
                  <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                    Not joined
                  </p>
                )}
              </div>
              <p className="font-display shrink-0 text-4xl text-[var(--color-stone-900)]">
                {account?.pointsBalance ?? 0}
                <span className="ml-1 font-sans text-sm font-normal text-[var(--color-stone-500)]">
                  points
                </span>
              </p>
            </div>
            {account ? (
              <>
                <section aria-labelledby={`badges-${customer.id}`}>
                  <h2
                    id={`badges-${customer.id}`}
                    className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]"
                  >
                    Badges
                  </h2>
                  <BadgesShelf milestones={milestones} />
                </section>
                <section aria-labelledby={`milestones-${customer.id}`}>
                  <h2
                    id={`milestones-${customer.id}`}
                    className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]"
                  >
                    Tailoring milestones
                  </h2>
                  {milestones.length ? (
                    <ul className="grid gap-2">
                      {milestones.map((award) => {
                        const presentation = milestonePresentation({
                          kind: award.kind,
                          label: award.label,
                          points: award.points,
                          status: award.status,
                        });
                        return (
                          <li key={award.id} className="customer-panel p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-[var(--color-stone-900)]">
                                {presentation.headline}
                              </p>
                              <Badge
                                tone={
                                  presentation.tone === "reversed"
                                    ? "neutral"
                                    : "success"
                                }
                              >
                                {award.status === "awarded"
                                  ? `${award.points} pts`
                                  : "Corrected"}
                              </Badge>
                            </div>
                            <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                              {presentation.detail}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-[var(--color-stone-500)]">
                      Milestones appear as meaningful stages — first commission,
                      return orders, new categories, and considered cloth —
                      without streaks or chance.
                    </p>
                  )}
                </section>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                    Available rewards
                  </p>
                  <div className="grid gap-2">
                    {rewards
                      .filter((reward) => reward.active)
                      .map((reward) => (
                        <form
                          key={reward.id}
                          action={redeemReward}
                          className="customer-list-row flex-wrap px-4 py-3 transition-colors hover:bg-white/70"
                        >
                          <input
                            type="hidden"
                            name="rewardId"
                            value={reward.id}
                          />
                          <span className="min-w-0 text-sm text-[var(--color-stone-800)]">
                            {reward.name} · {reward.pointsCost} points
                          </span>
                          <Button
                            type="submit"
                            size="sm"
                            variant="outline"
                            className="customer-button shrink-0"
                            disabled={account.pointsBalance < reward.pointsCost}
                          >
                            Redeem
                          </Button>
                        </form>
                      ))}
                    {rewards.filter((reward) => reward.active).length === 0 ? (
                      <p className="text-sm text-[var(--color-stone-500)]">
                        No rewards available yet.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="border-t border-[var(--customer-border)] pt-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                    Introduce a friend
                  </p>
                  <form
                    id="referrals"
                    action={inviteFriend}
                    className="flex scroll-mt-24 flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="hidden"
                      name="retailerId"
                      value={customer.retailerId}
                    />
                    <Input
                      name="referredEmail"
                      type="email"
                      placeholder="Their email address"
                      required
                    />
                    <Button type="submit" className="customer-button">
                      Send invitation
                    </Button>
                  </form>
                </div>
                {referrals.length ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                      {referrals.length} introduction
                      {referrals.length === 1 ? "" : "s"} sent
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {referrals.map((referral) => (
                        <li
                          key={referral.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-[var(--color-stone-700)]">
                            {referral.referredEmail}
                          </span>
                          <Badge tone={REFERRAL_TONE[referral.status]}>
                            {REFERRAL_STATUS_LABELS[referral.status]}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <form action={joinLoyalty}>
                <input
                  type="hidden"
                  name="retailerId"
                  value={customer.retailerId}
                />
                <Button type="submit">Join loyalty programme</Button>
              </form>
            )}
          </section>
        ),
      )}
      {relationships.length === 0 ? (
        <section className="customer-panel paon-reveal p-6">
          <p className="text-sm text-[var(--color-stone-500)]">
            Shop or book with a retailer to begin a relationship.
          </p>
        </section>
      ) : null}
    </div>
  );
}
