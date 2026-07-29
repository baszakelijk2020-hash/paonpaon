import { CampaignRepository, ProductRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { notFound } from "next/navigation";

import {
  setCampaignStatus,
  setCampaignTargetProduct,
  upsertCampaign,
  upsertCampaignAudienceRule,
} from "./actions";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function CampaignSettingsPage() {
  const session = await requireSession();
  if (!retailerRoleAtLeast(session.retailerRole, "manager")) {
    notFound();
  }

  const supabase = await getSupabaseServerClient();
  const campaignRepo = new CampaignRepository(supabase);
  const [campaigns, products] = await Promise.all([
    campaignRepo.listByRetailer(session.retailerId),
    new ProductRepository(supabase).findByRetailer(session.retailerId as never),
  ]);
  const activeProducts = products.filter(
    (product) => product.status === "active",
  );

  const campaignsWithRules = await Promise.all(
    campaigns.map(async (campaign) => ({
      campaign,
      rules: await campaignRepo.listAudienceRules(campaign.id),
      targets: await campaignRepo.listTargetProducts(campaign.id),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Private offers & campaigns
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Target fabric, category, product, audience, and schedule through
          explainable consent-aware rules. Marketing consent is never reused for
          personalization. Seven-day challenges grant only restrained, capped
          rewards.
        </p>
      </div>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Create campaign
        </h2>
        <form
          action={upsertCampaign}
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <label className="flex flex-col gap-1 text-sm">
            Kind
            <select
              name="kind"
              required
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            >
              <option value="private_offer">Private offer</option>
              <option value="wardrobe_challenge">
                Seven-day wardrobe challenge
              </option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Status
            <select
              name="status"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="draft"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="ended">Ended</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Title
            <input
              name="title"
              required
              maxLength={120}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Summary
            <textarea
              name="summary"
              required
              maxLength={500}
              rows={2}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Why this is shown (explanation)
            <textarea
              name="explanation"
              required
              maxLength={500}
              rows={2}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Frequency
            <select
              name="frequency"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="weekly"
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Timezone
            <input
              name="timezone"
              defaultValue="Europe/Amsterdam"
              required
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Preferred local hour
            <input
              name="preferredLocalHour"
              type="number"
              min={0}
              max={23}
              defaultValue={9}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Reward (challenges)
            <select
              name="rewardKind"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue=""
            >
              <option value="">None</option>
              <option value="personalized_tie">Personalised tie</option>
              <option value="personalized_shirt">Personalised shirt</option>
              <option value="short_lived_offer">Short-lived offer</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            Reward label
            <input
              name="rewardLabel"
              maxLength={120}
              placeholder="A personalised silk tie"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" size="sm">
              Save campaign
            </Button>
          </div>
        </form>
      </section>

      {campaignsWithRules.length === 0 ? (
        <p role="status" className="text-sm text-[var(--color-stone-500)]">
          No campaigns yet.
        </p>
      ) : (
        campaignsWithRules.map(({ campaign, rules, targets }) => (
          <section
            key={campaign.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-[var(--color-stone-900)]">
                  {campaign.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-stone-500)]">
                  {campaign.kind.replaceAll("_", " ")} · {campaign.status} ·{" "}
                  {campaign.frequency} · {campaign.timezone}
                </p>
                <p className="mt-2 text-sm text-[var(--color-stone-700)]">
                  {campaign.explanation}
                </p>
              </div>
              <form action={setCampaignStatus} className="flex gap-2">
                <input type="hidden" name="campaignId" value={campaign.id} />
                {campaign.status === "active" ? (
                  <>
                    <input type="hidden" name="status" value="paused" />
                    <Button type="submit" size="sm" variant="outline">
                      Pause
                    </Button>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="status" value="active" />
                    <Button type="submit" size="sm">
                      Activate
                    </Button>
                  </>
                )}
              </form>
            </div>

            <div className="mt-4 border-t border-[var(--color-stone-100)] pt-4">
              <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                Audience rules
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-[var(--color-stone-600)]">
                {rules.length === 0 ? (
                  <li>Consented members (default personalization gate).</li>
                ) : (
                  rules.map((rule) => (
                    <li key={rule.id}>
                      {rule.ruleKind.replaceAll("_", " ")} — {rule.explanation}
                      {rule.requirePersonalizationConsent
                        ? " (personalization required)"
                        : ""}
                    </li>
                  ))
                )}
              </ul>
              <form
                action={upsertCampaignAudienceRule}
                className="mt-3 grid gap-2 md:grid-cols-3"
              >
                <input type="hidden" name="campaignId" value={campaign.id} />
                <select
                  name="ruleKind"
                  className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                  defaultValue="personalization_consent"
                >
                  <option value="personalization_consent">
                    Personalization consent
                  </option>
                  <option value="fabric_concept">Fabric concept</option>
                  <option value="category_concept">Category concept</option>
                  <option value="style_preference">Style preference</option>
                  <option value="loyalty_tier">Loyalty tier</option>
                </select>
                <input
                  name="conceptId"
                  placeholder="Concept UUID (optional)"
                  className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm"
                />
                <input
                  name="explanation"
                  required
                  placeholder="Why this member sees it"
                  className="rounded border border-[var(--color-stone-200)] px-3 py-2 text-sm md:col-span-2"
                />
                <Button type="submit" size="sm" variant="outline">
                  Add rule
                </Button>
              </form>
            </div>

            <div className="mt-4 border-t border-[var(--color-stone-100)] pt-4">
              <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                Target products
              </h3>
              {activeProducts.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--color-stone-500)]">
                  No active products.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--color-stone-100)]">
                  {activeProducts.slice(0, 12).map((product) => {
                    const row = targets.find(
                      (target) => target.productId === product.id,
                    );
                    const active = row?.active ?? false;
                    return (
                      <li
                        key={product.id}
                        className="flex flex-wrap items-center justify-between gap-3 py-2"
                      >
                        <span className="text-sm text-[var(--color-stone-900)]">
                          {product.name}
                        </span>
                        <form action={setCampaignTargetProduct}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input
                            type="hidden"
                            name="productId"
                            value={product.id}
                          />
                          <input
                            type="hidden"
                            name="active"
                            value={active ? "false" : "true"}
                          />
                          <Button type="submit" size="sm" variant="outline">
                            {active ? "Remove" : "Include"}
                          </Button>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
