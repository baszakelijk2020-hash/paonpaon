import { requireRetailerRole } from "@paon/auth";
import { LoyaltyRepository } from "@paon/database";
import {
  LOYALTY_BUILT_IN_MILESTONE_KINDS,
  LOYALTY_MILESTONE_KIND_LABELS,
  REWARD_TYPE_LABELS,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { Card } from "@paon/ui/components/Card";
import { Input } from "@paon/ui/components/Input";
import { redirect } from "next/navigation";

import {
  createPeerMilestone,
  createReward,
  saveBuiltInMilestone,
  saveProgram,
} from "./actions";

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
  const [program, rewards, accounts, milestones] = await Promise.all([
    repository.findProgram(session.retailerId),
    repository.findRewards(session.retailerId),
    repository.findAccountsByRetailer(session.retailerId),
    repository.findMilestoneDefinitions(session.retailerId),
  ]);
  const builtIns = milestones.filter((item) => item.kind !== "custom");
  const peers = milestones.filter((item) => item.kind === "custom");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-[var(--color-stone-900)]">
          Loyalty & rewards
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Reward considered progression — never chance-based or discount-retail
          in tone.
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
        <h2 className="mb-2 text-lg font-medium">Tailoring milestones</h2>
        <p className="mb-4 text-sm text-[var(--color-stone-500)]">
          Idempotent recognition for first commission, return orders, new
          categories, premium construction, and advanced cloth. Awards write to
          the existing loyalty ledger only.
        </p>
        <div className="divide-y divide-[var(--color-stone-100)]">
          {LOYALTY_BUILT_IN_MILESTONE_KINDS.map((kind) => {
            const definition = builtIns.find((item) => item.kind === kind);
            return (
              <form
                key={kind}
                action={saveBuiltInMilestone}
                className="grid gap-3 py-3 sm:grid-cols-[1fr_7rem_auto_auto] sm:items-end"
              >
                <input type="hidden" name="kind" value={kind} />
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {LOYALTY_MILESTONE_KIND_LABELS[kind]}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {definition?.explanation ??
                      "Recognised stage in the tailoring relationship."}
                  </p>
                </div>
                <label className="text-sm" htmlFor={`points-${kind}`}>
                  Points
                  <Input
                    id={`points-${kind}`}
                    name="points"
                    type="number"
                    min="1"
                    max="1000"
                    defaultValue={definition?.points ?? 100}
                    required
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    name="active"
                    type="checkbox"
                    defaultChecked={definition?.active ?? true}
                  />
                  Active
                </label>
                <Button type="submit" variant="outline" size="sm">
                  Save
                </Button>
              </form>
            );
          })}
        </div>
        <div className="mt-6 border-t border-[var(--color-stone-100)] pt-5">
          <h3 className="mb-3 text-base font-medium">Configured peer</h3>
          <form
            action={createPeerMilestone}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Input
              name="customKey"
              placeholder="house-tweed"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              required
              aria-label="Peer milestone key"
            />
            <Input name="label" placeholder="House tweed" required />
            <Input
              name="explanation"
              placeholder="Recognised for commissioning house tweed."
              required
              className="sm:col-span-2"
            />
            <Input
              name="matchConceptIds"
              placeholder="Concept UUID(s), comma-separated"
              required
              aria-label="Matching concept ids"
            />
            <Input
              name="points"
              type="number"
              min="1"
              max="1000"
              placeholder="Points"
              required
            />
            <Button type="submit" className="sm:col-span-2">
              Add peer milestone
            </Button>
          </form>
          {peers.length ? (
            <ul className="mt-4 flex flex-col gap-2">
              {peers.map((peer) => (
                <li
                  key={peer.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[var(--color-stone-800)]">
                    {peer.label}
                    <span className="text-[var(--color-stone-500)]">
                      {" "}
                      · {peer.customKey}
                    </span>
                  </span>
                  <span className="text-[var(--color-stone-700)]">
                    {peer.points} pts
                    {!peer.active ? " · inactive" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-medium">Create a reward</h2>
        <form action={createReward} className="grid gap-4 sm:grid-cols-2">
          <Input name="name" placeholder="Complimentary alteration" required />
          <select
            name="type"
            className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
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
            className="h-10 rounded-[var(--radius-md)] border border-[var(--color-stone-200)] px-3 text-sm"
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
                className="flex items-center justify-between rounded-[var(--radius-md)] px-2 py-3 transition-colors duration-[var(--duration-quiet)] ease-[var(--ease-out-quiet)] hover:bg-[var(--color-stone-50)]"
              >
                <div>
                  <p className="font-medium text-[var(--color-stone-900)]">
                    {item.name}
                  </p>
                  <p className="text-sm text-[var(--color-stone-500)]">
                    {REWARD_TYPE_LABELS[item.type]}
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
