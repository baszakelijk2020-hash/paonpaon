import {
  LoyaltyRepository,
  RetailerRepository,
  WardrobeRepository,
} from "@paon/database";
import {
  LOYALTY_TIER_LABELS,
  milestonePresentation,
  REFERRAL_STATUS_LABELS,
} from "@paon/domain";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Input } from "@paon/ui/components/Input";

import { inviteFriend, joinLoyalty, redeemReward } from "./actions";
import { BadgesShelf } from "./badges-shelf";
import { LoyaltyTierCards } from "./loyalty-tier-cards";

import { getCustomersForUser } from "@/lib/customer-context";
import { getViewerSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const TIER_TONE = {
  metre: "neutral",
  milli: "neutral",
  micron: "success",
} as const;

const REFERRAL_TONE = {
  invited: "neutral",
  signed_up: "warning",
  first_purchase_completed: "success",
  rewarded: "success",
} as const;

export default async function LoyaltyPage() {
  const session = await getViewerSession();
  const client = await getSupabaseServerClient();
  const customers = await getCustomersForUser(session.userId);
  const loyalty = new LoyaltyRepository(client);
  const retailers = new RetailerRepository(client);
  const wardrobe = new WardrobeRepository(client);
  const rollingStart = Date.now() - 365 * 24 * 60 * 60 * 1000;
  // These five are independent of one another. Awaited as object-literal fields they
  // ran strictly one after the next — five round trips deep per customer. Batched, the
  // whole set costs one round trip's worth of latency.
  const relationships = await Promise.all(
    customers.map(async (customer) => {
      const [
        retailer,
        program,
        account,
        rewards,
        referrals,
        milestones,
        items,
      ] = await Promise.all([
        retailers.findById(customer.retailerId),
        loyalty.findProgram(customer.retailerId),
        loyalty.findAccountByCustomer(customer.id),
        loyalty.findRewards(customer.retailerId),
        loyalty.findReferrals(customer.id),
        loyalty.findMilestoneAwardsForCustomer(customer.id),
        wardrobe.findByCustomer(customer.id),
      ]);
      return {
        customer,
        retailer,
        program,
        account,
        rewards,
        referrals,
        milestones,
        completedSets: items.filter(
          (item) =>
            item.categoryCode === "suit" &&
            Date.parse(item.acquiredAt ?? item.createdAt) >= rollingStart,
        ).length,
      };
    }),
  );
  return (
    <div className="customer-page loyalty-environment flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head items-end gap-6 pb-3">
        <div>
          <p className="customer-kicker mb-2 text-white/55">Your membership</p>
          <h1 className="font-brand text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Rewards &amp; Referrals
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            See your points, choose a reward, and share a retailer you love.
          </p>
        </div>
      </header>
      {relationships.map(
        (
          {
            customer,
            retailer,
            program,
            account,
            rewards,
            referrals,
            milestones,
            completedSets,
          },
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
                  aria-label="Membership tiers and points"
                  className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]"
                >
                  <div
                    className="pe-card rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
                    data-pe-card
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <p className="customer-kicker text-white/55">
                          Membership tiers
                        </p>
                        <h2 className="mt-2">Every relationship deepens.</h2>
                      </div>
                      <Badge tone={TIER_TONE[account.tier]}>
                        You are {LOYALTY_TIER_LABELS[account.tier]}
                      </Badge>
                    </div>
                    <div className="mt-6">
                      <LoyaltyTierCards
                        name={customer.fullName}
                        currentTier={account.tier}
                        completedSets={completedSets}
                      />
                    </div>
                  </div>
                  <div
                    className="pe-card pe-card-mint rounded-[32px] bg-[#b8e6be] p-6 text-[#181818] sm:p-8"
                    data-pe-card
                  >
                    <p className="customer-kicker text-[#181818]/60">
                      Your points
                    </p>
                    <p className="mt-3 text-5xl font-semibold tracking-[-0.06em]">
                      {account.pointsBalance}
                    </p>
                    <p className="mt-1 text-sm text-[#181818]/65">
                      available points
                    </p>
                    <dl className="mt-6 grid gap-3 text-sm">
                      <div className="flex items-center justify-between gap-3 border-t border-[#181818]/10 pt-3">
                        <dt className="text-[#181818]/60">Lifetime earned</dt>
                        <dd className="font-medium">
                          {account.lifetimePoints} points
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-[#181818]/10 pt-3">
                        <dt className="text-[#181818]/60">Every €1 spent</dt>
                        <dd className="font-medium">
                          {program?.pointsPerCurrencyUnit ?? 0} points
                        </dd>
                      </div>
                    </dl>
                  </div>
                </section>
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
                    className="scroll-mt-24"
                  >
                    <input
                      type="hidden"
                      name="retailerId"
                      value={customer.retailerId}
                    />
                    <p className="mb-4 max-w-xl text-sm text-[#181818]/65">
                      {program?.referralPoints ?? 0} points are added when a
                      friend joins and completes their first commission.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
                      {[1, 2, 3].map((slot) => (
                        <Input
                          key={slot}
                          name="referredEmail"
                          type="email"
                          placeholder={`Friend ${slot} email`}
                          required={slot === 1}
                        />
                      ))}
                      <Button type="submit" className="customer-button">
                        Refer friends
                      </Button>
                    </div>
                    <p className="mt-3 text-xs text-[#181818]/55">
                      Each invitation has its own referral code and progress
                      tracker.
                    </p>
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
        <section className="paon-reveal flex flex-col gap-5" data-guest-preview>
          <div
            className="pe-card flex flex-wrap items-start justify-between gap-6"
            data-pe-card
          >
            <div>
              <p className="customer-kicker">Nebel &amp; Spiegel membership</p>
              <h2 className="mt-2">Rewards that follow your wardrobe.</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                Earn points from commissions and meaningful introductions. Sign
                in to make this your own.
              </p>
            </div>
            <p className="text-6xl font-semibold leading-none tracking-[-0.06em] sm:text-7xl">
              0
              <span className="ml-2 font-sans text-base font-normal tracking-normal">
                points
              </span>
            </p>
          </div>
          <LoyaltyTierCards
            name="J. Smith"
            currentTier="milli"
            completedSets={0}
          />
          <section
            className="pe-card rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
            data-pe-card
          >
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="customer-kicker text-white/55">
                  Achievement collection
                </p>
                <h2 className="mt-2">Your achievements.</h2>
              </div>
              <span className="text-xs text-white/45">1/6 earned</span>
            </div>
            <BadgesShelf milestones={[]} />
          </section>
          <div className="grid hidden gap-3 lg:grid-cols-[1.25fr_0.75fr]">
            <div
              className="pe-card rounded-[32px] bg-[#191b1d] p-6 text-white sm:p-8"
              data-pe-card
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="customer-kicker text-white/55">
                    Membership tiers
                  </p>
                  <h2 className="mt-2">Every relationship deepens.</h2>
                </div>
                <Badge tone="neutral">Preview</Badge>
              </div>
              <ol className="mt-6 grid gap-2 sm:grid-cols-3">
                <li className="rounded-[22px] bg-white/[0.06] p-4">
                  <p className="text-sm font-semibold">Milli</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    Your first privileges begin here.
                  </p>
                </li>
                <li className="rounded-[22px] bg-white p-4 text-[#181818]">
                  <p className="text-sm font-semibold">Metre</p>
                  <p className="mt-2 text-xs leading-5 text-[#181818]/65">
                    For a growing wardrobe and return visits.
                  </p>
                  <span className="mt-4 inline-flex rounded-full bg-[#181818] px-2.5 py-1 text-xs font-medium text-white">
                    Example tier
                  </span>
                </li>
                <li className="rounded-[22px] bg-white/[0.06] p-4">
                  <p className="text-sm font-semibold">Micron</p>
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    For the highest level of private-client recognition.
                  </p>
                </li>
              </ol>
            </div>
            <div
              className="pe-card pe-card-mint rounded-[32px] bg-[#b8e6be] p-6 text-[#181818] sm:p-8"
              data-pe-card
            >
              <p className="customer-kicker text-[#181818]/60">Your points</p>
              <p className="mt-3 text-5xl font-semibold tracking-[-0.06em]">
                0
              </p>
              <p className="mt-1 text-sm text-[#181818]/65">available points</p>
              <dl className="mt-6 grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3 border-t border-[#181818]/10 pt-3">
                  <dt className="text-[#181818]/60">Lifetime earned</dt>
                  <dd className="font-medium">0 points</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[#181818]/10 pt-3">
                  <dt className="text-[#181818]/60">Every €1 spent</dt>
                  <dd className="font-medium">10 points</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div
              className="pe-card pe-card-lavender rounded-[32px] bg-[#c7c1ef] p-6 text-[#181818] sm:p-8"
              data-pe-card
            >
              <p className="customer-kicker mb-4 text-[#181818]/60">
                Available rewards
              </p>
              <div className="grid gap-2">
                <div className="flex items-center justify-between rounded-[22px] bg-[#181818]/[0.07] px-4 py-3 text-sm">
                  <span>Personal fitting appointment · 800 points</span>
                  <span className="font-medium">Sign in to redeem</span>
                </div>
                <div className="flex items-center justify-between rounded-[22px] bg-[#181818]/[0.07] px-4 py-3 text-sm">
                  <span>Early access to new cloth · 1,200 points</span>
                  <span className="font-medium">Sign in to redeem</span>
                </div>
              </div>
            </div>
            <div
              className="pe-card pe-card-coral rounded-[32px] bg-[#f0b6a4] p-6 text-[#181818] sm:p-8"
              data-pe-card
            >
              <p className="customer-kicker text-[#181818]/60">
                Introduce a friend
              </p>
              <p className="mt-3 text-sm text-[#181818]/65">
                Earn 500 points when a friend joins and completes their first
                commission.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <input
                  disabled
                  placeholder="Friend 1 email"
                  className="min-h-11 rounded-full border-0 bg-white/55 px-4 text-sm placeholder:text-[#181818]/45"
                />
                <input
                  disabled
                  placeholder="Friend 2 email"
                  className="min-h-11 rounded-full border-0 bg-white/55 px-4 text-sm placeholder:text-[#181818]/45"
                />
                <input
                  disabled
                  placeholder="Friend 3 email"
                  className="min-h-11 rounded-full border-0 bg-white/55 px-4 text-sm placeholder:text-[#181818]/45"
                />
              </div>
              <a
                href="/login?redirectTo=/loyalty"
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#181818] px-5 text-sm font-medium text-white"
              >
                Sign in to refer friends
              </a>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
