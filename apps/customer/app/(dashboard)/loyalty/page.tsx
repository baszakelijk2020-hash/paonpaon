import {
  CustomerRepository,
  LoyaltyRepository,
  RetailerRepository,
} from "@paon/database";
import { Badge } from "@paon/ui/components/Badge";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { humaniseStatus } from "@paon/utils";

import { inviteFriend, joinLoyalty, redeemReward } from "./actions";

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
    })),
  );
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Loyalty &amp; rewards
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Your memberships, rewards and referrals across retailers.
        </p>
      </div>
      {relationships.map(
        ({ customer, retailer, account, rewards, referrals }, index) => (
          <Card
            key={customer.id}
            className="paon-reveal flex flex-col gap-5"
            style={{ animationDelay: `${index * 120}ms` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-accent text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                  {retailer?.displayName ?? "Retailer"}
                </p>
                {account ? (
                  <Badge tone={TIER_TONE[account.tier]} className="mt-1">
                    {account.tier}
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
                          className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] p-3 transition-[border-color,box-shadow] duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] hover:border-[var(--color-stone-400)] hover:shadow-[var(--shadow-lifted)]"
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
                            className="shrink-0"
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
                <form
                  id="referrals"
                  action={inviteFriend}
                  className="flex scroll-mt-24 flex-col gap-2 border-t border-[var(--color-stone-100)] pt-5 sm:flex-row"
                >
                  <input
                    type="hidden"
                    name="retailerId"
                    value={customer.retailerId}
                  />
                  <Input
                    name="referredEmail"
                    type="email"
                    placeholder="Friend's email"
                    required
                  />
                  <Button type="submit" variant="outline">
                    Invite friend
                  </Button>
                </form>
                {referrals.length ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.15em] text-[var(--color-stone-500)]">
                      {referrals.length} referral
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
                            {humaniseStatus(referral.status)}
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
          </Card>
        ),
      )}
      {relationships.length === 0 ? (
        <Card className="paon-reveal">
          <p className="text-sm text-[var(--color-stone-500)]">
            Shop or book with a retailer to begin a relationship.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
