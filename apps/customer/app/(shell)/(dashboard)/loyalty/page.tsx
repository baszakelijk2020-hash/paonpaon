import { LoyaltyRepository, RetailerRepository } from "@paon/database";
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

import { getCustomersForUser } from "@/lib/customer-context";
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
  const customers = await getCustomersForUser(session.userId);
  const loyalty = new LoyaltyRepository(client);
  const retailers = new RetailerRepository(client);
  // These five are independent of one another. Awaited as object-literal fields they
  // ran strictly one after the next — five round trips deep per customer. Batched, the
  // whole set costs one round trip's worth of latency.
  const relationships = await Promise.all(
    customers.map(async (customer) => {
      const [retailer, account, rewards, referrals, milestones] =
        await Promise.all([
          retailers.findById(customer.retailerId),
          loyalty.findAccountByCustomer(customer.id),
          loyalty.findRewards(customer.retailerId),
          loyalty.findReferrals(customer.id),
          loyalty.findMilestoneAwardsForCustomer(customer.id),
        ]);
      return { customer, retailer, account, rewards, referrals, milestones };
    }),
  );
  return (
    <div className="customer-page flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head items-end gap-6 pb-3">
        <div>
          <p className="customer-kicker mb-2 text-white/55">Your membership</p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Rewards &amp; Referrals
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            See your points, choose a reward, and share a retailer you love.
          </p>
        </div>
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
            className="paon-reveal flex flex-col gap-5"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            {/* One card for the membership: who it is with, where it stands,
                and — until joined — the one thing to do about it. The join
                button used to sit alone in a second tile beneath a card that
                said "Not joined"; it belongs here. */}
            <div
              className="pe-card flex flex-wrap items-start justify-between gap-6"
              data-pe-card
            >
              <div className="min-w-0">
                <p className="customer-kicker">
                  {retailer?.displayName ?? "Retailer"}
                </p>
                <h2 className="mt-2">
                  {account ? "A little more, for you." : "Make it rewarding."}
                </h2>
                <p className="mt-1 max-w-md">
                  {account
                    ? "Your points and privileges, all in one place."
                    : "Join your retailer's programme to see your points and available rewards."}
                </p>
                {account ? (
                  <Badge tone={TIER_TONE[account.tier]} className="mt-3">
                    {LOYALTY_TIER_LABELS[account.tier]}
                  </Badge>
                ) : (
                  <form action={joinLoyalty} className="mt-4">
                    <input
                      type="hidden"
                      name="retailerId"
                      value={customer.retailerId}
                    />
                    <Button type="submit" className="customer-button">
                      Join loyalty programme
                    </Button>
                  </form>
                )}
              </div>
              <p className="shrink-0 text-6xl font-semibold leading-none tracking-[-0.06em] sm:text-7xl">
                {account?.pointsBalance ?? 0}
                <span className="ml-2 font-sans text-base font-normal tracking-normal">
                  points
                </span>
              </p>
            </div>
            {account ? (
              <>
                <section
                  aria-labelledby={`badges-${customer.id}`}
                  className="pe-card rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
                  data-pe-card
                >
                  <h2
                    id={`badges-${customer.id}`}
                    className="customer-kicker mb-4 text-white/55"
                  >
                    Badges
                  </h2>
                  <BadgesShelf milestones={milestones} />
                </section>
                <section
                  aria-labelledby={`milestones-${customer.id}`}
                  className="pe-card pe-card-mint rounded-[32px] bg-[#b8e6be] p-6 text-[#181818] sm:p-8"
                  data-pe-card
                >
                  <h2
                    id={`milestones-${customer.id}`}
                    className="customer-kicker mb-4 text-[#181818]/60"
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
                          <li
                            key={award.id}
                            className="rounded-[22px] bg-[#181818]/[0.07] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium text-[#181818]">
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
                            <p className="mt-1 text-sm text-[#181818]/65">
                              {presentation.detail}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#181818]/60">
                      Milestones appear as meaningful stages — first commission,
                      return orders, new categories, and considered cloth —
                      without streaks or chance.
                    </p>
                  )}
                </section>
                <div
                  className="pe-card pe-card-lavender rounded-[32px] bg-[#c7c1ef] p-6 text-[#181818] sm:p-8"
                  data-pe-card
                >
                  <p className="customer-kicker mb-4 text-[#181818]/60">
                    Available rewards
                  </p>
                  <div className="grid gap-2">
                    {rewards
                      .filter((reward) => reward.active)
                      .map((reward) => (
                        <form
                          key={reward.id}
                          action={redeemReward}
                          className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 rounded-[22px] bg-[#181818]/[0.07] px-4 py-3 transition-colors hover:bg-[#181818]/[0.11]"
                        >
                          <input
                            type="hidden"
                            name="rewardId"
                            value={reward.id}
                          />
                          <span className="min-w-0 text-sm text-[#181818]">
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
                      <p className="text-sm text-[#181818]/60">
                        No rewards available yet.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div
                  className="pe-card pe-card-coral rounded-[32px] bg-[#f0b6a4] p-6 text-[#181818] sm:p-8"
                  data-pe-card
                >
                  <p className="customer-kicker mb-4 text-[#181818]/60">
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
                  <div
                    className="pe-card rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
                    data-pe-card
                  >
                    <p className="customer-kicker mb-4 text-white/55">
                      {referrals.length} introduction
                      {referrals.length === 1 ? "" : "s"} sent
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {referrals.map((referral) => (
                        <li
                          key={referral.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-white/75">
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
            ) : null}
          </section>
        ),
      )}
      {relationships.length === 0 ? (
        <section
          className="pe-card paon-reveal rounded-[32px] bg-[#191b1d] p-8"
          data-pe-card
        >
          <p className="text-sm text-white/60">
            Shop or book with a retailer to begin a relationship.
          </p>
        </section>
      ) : null}
    </div>
  );
}
