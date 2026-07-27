import { requireRetailerRole } from "@paon/auth";
import { LoyaltyRepository } from "@paon/database";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { redirect } from "next/navigation";

import { createReward, saveProgram } from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function LoyaltyPage() {
  const session = await requireSession();
  try {
    requireRetailerRole(session.retailerRole, "manager");
  } catch {
    redirect("/dashboard");
  }
  const repository = new LoyaltyRepository(await getSupabaseServerClient());
  const [program, rewards, accounts] = await Promise.all([
    repository.findProgram(session.retailerId),
    repository.findRewards(session.retailerId),
    repository.findAccountsByRetailer(session.retailerId),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Loyalty & rewards
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Reward repeat purchases and customer referrals.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">Members</p>
          <p className="text-3xl font-medium">{accounts.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">Points issued</p>
          <p className="text-3xl font-medium">
            {accounts.reduce((total, item) => total + item.lifetimePoints, 0)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--color-stone-500)]">
            Active rewards
          </p>
          <p className="text-3xl font-medium">
            {rewards.filter((item) => item.active).length}
          </p>
        </Card>
      </div>
      <Card>
        <h2 className="mb-4 text-lg font-medium">Programme rules</h2>
        <form action={saveProgram} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm" htmlFor="loyaltyName">
            Name
            <Input
              id="loyaltyName"
              name="name"
              defaultValue={program?.name ?? "Loyalty programme"}
              required
            />
          </label>
          <label className="text-sm" htmlFor="pointsPerCurrencyUnit">
            Points per currency unit
            <Input
              id="pointsPerCurrencyUnit"
              name="pointsPerCurrencyUnit"
              type="number"
              min="0"
              defaultValue={program?.pointsPerCurrencyUnit ?? 1}
              required
            />
          </label>
          <label className="text-sm" htmlFor="referralPoints">
            Referral bonus points
            <Input
              id="referralPoints"
              name="referralPoints"
              type="number"
              min="0"
              defaultValue={program?.referralPoints ?? 500}
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="enabled"
              type="checkbox"
              defaultChecked={program?.enabled ?? true}
            />
            Programme enabled
          </label>
          <Button type="submit">Save programme</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-medium">Create a reward</h2>
        <form action={createReward} className="grid gap-4 sm:grid-cols-2">
          <Input name="name" placeholder="Complimentary alteration" required />
          <select
            name="type"
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
          >
            <option value="gift">Gift</option>
            <option value="discount_fixed">Fixed discount</option>
            <option value="discount_percent">Percentage discount</option>
            <option value="early_access">Early access</option>
          </select>
          <Input
            name="pointsCost"
            type="number"
            min="1"
            placeholder="Points cost"
            required
          />
          <select
            name="minimumTier"
            className="h-10 rounded-[var(--radius-sm)] border border-[var(--color-stone-300)] px-3 text-sm"
          >
            <option value="">All tiers</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
            <option value="platinum">Platinum</option>
          </select>
          <Button type="submit">Create reward</Button>
        </form>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-medium">Reward catalogue</h2>
        {rewards.length ? (
          <div className="divide-y divide-[var(--color-stone-100)]">
            {rewards.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-[var(--radius-sm)] px-2 py-3 transition-colors duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] hover:bg-[var(--color-stone-50)]"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {item.name}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {item.type.replaceAll("_", " ")}
                    {item.minimumTier ? ` · ${item.minimumTier}+` : ""}
                    {!item.active ? " · inactive" : ""}
                  </p>
                </div>
                <strong className="text-[var(--color-stone-900)]">
                  {item.pointsCost} points
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-stone-500)]">
            No rewards yet.
          </p>
        )}
      </Card>
    </div>
  );
}
