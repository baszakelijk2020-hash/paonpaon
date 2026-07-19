import {
  CustomerRepository,
  LoyaltyRepository,
  RetailerRepository,
} from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";

import { inviteFriend, joinLoyalty, redeemReward } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

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
        <h1 className="text-2xl font-medium text-[var(--color-stone-900)]">
          Loyalty & rewards
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Your memberships, rewards and referrals across retailers.
        </p>
      </div>
      {relationships.map(
        ({ customer, retailer, account, rewards, referrals }) => (
          <Card key={customer.id} className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-medium">
                  {retailer?.displayName ?? "Retailer"}
                </h2>
                <p className="text-sm capitalize text-[var(--color-stone-500)]">
                  {account?.tier ?? "Not joined"}
                </p>
              </div>
              <p className="text-3xl font-medium">
                {account?.pointsBalance ?? 0}
                <span className="ml-1 text-sm font-normal">points</span>
              </p>
            </div>
            {account ? (
              <>
                <div>
                  <h3 className="mb-2 font-medium">Available rewards</h3>
                  <div className="grid gap-2">
                    {rewards
                      .filter((reward) => reward.active)
                      .map((reward) => (
                        <form
                          key={reward.id}
                          action={redeemReward}
                          className="flex items-center justify-between rounded border p-3"
                        >
                          <input
                            type="hidden"
                            name="rewardId"
                            value={reward.id}
                          />
                          <span>
                            {reward.name} · {reward.pointsCost} points
                          </span>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={account.pointsBalance < reward.pointsCost}
                          >
                            Redeem
                          </Button>
                        </form>
                      ))}
                  </div>
                </div>
                <form
                  action={inviteFriend}
                  className="flex flex-col gap-2 sm:flex-row"
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
                  <Button type="submit">Invite friend</Button>
                </form>
                {referrals.length ? (
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {referrals.length} referral
                    {referrals.length === 1 ? "" : "s"} sent
                  </p>
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
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            Shop or book with a retailer to begin a relationship.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
