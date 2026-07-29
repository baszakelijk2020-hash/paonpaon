import { CampaignRepository, ProductRepository } from "@paon/database";
import { retailerRoleAtLeast } from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import { notFound } from "next/navigation";

import {
  setCampaignTarget,
  toggleCampaignPaused,
  upsertCampaign,
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

  const targetsByCampaign = await Promise.all(
    campaigns.map(async (campaign) => ({
      campaignId: campaign.id,
      targets: await campaignRepo.listTargets(campaign.id),
    })),
  );
  const targetMap = new Map(
    targetsByCampaign.map(
      (entry) => [entry.campaignId, entry.targets] as const,
    ),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Campaigns
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Configure consent-aware private offers and seven-day wardrobe
          challenges. Audiences use personalization consent — never marketing
          consent.
        </p>
      </div>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          New campaign
        </h2>
        <form action={upsertCampaign} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-700)]">Kind</span>
            <select
              name="kind"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              defaultValue="private_offer"
            >
              <option value="private_offer">Private offer</option>
              <option value="seven_day_wardrobe">Seven-day wardrobe</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-700)]">Title</span>
            <input
              name="title"
              required
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-700)]">Description</span>
            <textarea
              name="description"
              rows={2}
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--color-stone-700)]">Schedule</span>
              <select
                name="scheduleFrequency"
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
                defaultValue="weekly"
              >
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--color-stone-700)]">Timezone</span>
              <input
                name="timezone"
                defaultValue="Europe/Amsterdam"
                className="rounded border border-[var(--color-stone-200)] px-3 py-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--color-stone-700)]">
              Reward (seven-day wardrobe)
            </span>
            <select
              name="rewardKind"
              className="rounded border border-[var(--color-stone-200)] px-3 py-2"
            >
              <option value="">None (private offer)</option>
              <option value="tie">Personalised tie</option>
              <option value="shirt">Shirt</option>
              <option value="short_lived_offer">Short-lived offer</option>
            </select>
          </label>
          <input type="hidden" name="active" value="true" />
          <input type="hidden" name="paused" value="false" />
          <input
            type="hidden"
            name="requiresPersonalizationConsent"
            value="true"
          />
          <Button type="submit" size="sm">
            Create campaign
          </Button>
        </form>
      </section>

      <section className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-4">
        <h2 className="font-display text-lg text-[var(--color-stone-900)]">
          Active rules
        </h2>
        {campaigns.length === 0 ? (
          <p
            role="status"
            className="mt-4 text-sm text-[var(--color-stone-500)]"
          >
            No campaigns configured yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--color-stone-100)]">
            {campaigns.map((campaign) => {
              const targets = targetMap.get(campaign.id) ?? [];
              return (
                <li key={campaign.id} className="py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[var(--color-stone-900)]">
                        {campaign.title}
                      </p>
                      <p className="text-xs text-[var(--color-stone-500)]">
                        {campaign.kind.replaceAll("_", " ")} ·{" "}
                        {campaign.scheduleFrequency} ·{" "}
                        {campaign.paused ? "Paused" : "Active"}
                      </p>
                      {campaign.description ? (
                        <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                          {campaign.description}
                        </p>
                      ) : null}
                    </div>
                    <form action={toggleCampaignPaused}>
                      <input
                        type="hidden"
                        name="campaignId"
                        value={campaign.id}
                      />
                      <input
                        type="hidden"
                        name="paused"
                        value={campaign.paused ? "false" : "true"}
                      />
                      <Button type="submit" size="sm" variant="outline">
                        {campaign.paused ? "Resume" : "Pause"}
                      </Button>
                    </form>
                  </div>
                  {activeProducts.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-[var(--color-stone-600)]">
                        Product targets
                      </p>
                      <ul className="mt-2 space-y-2">
                        {activeProducts.slice(0, 8).map((product) => {
                          const selected = targets.some(
                            (target) =>
                              target.targetType === "product" &&
                              target.targetId === product.id,
                          );
                          return (
                            <li
                              key={product.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>{product.name}</span>
                              <form action={setCampaignTarget}>
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
                                  name="label"
                                  value={product.name}
                                />
                                <input
                                  type="hidden"
                                  name="remove"
                                  value={selected ? "true" : "false"}
                                />
                                <Button type="submit" size="sm" variant="ghost">
                                  {selected ? "Remove" : "Target"}
                                </Button>
                              </form>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
