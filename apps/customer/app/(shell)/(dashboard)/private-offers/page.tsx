import {
  CampaignRepository,
  CustomerConsentRepository,
  ProductRepository,
  RetailerRepository,
  StyleProfileRepository,
} from "@paon/database";
import {
  asId,
  CAMPAIGN_REQUIRED_LOOK_SLOTS,
  challengeCompleteness,
  evaluateAudienceRules,
  isLookComplete,
  type Campaign,
  type CampaignChallengeEnrollment,
  type CampaignChallengeLook,
  type CampaignRewardGrant,
} from "@paon/domain";
import { Button } from "@paon/ui/components/Button";
import Link from "next/link";

import {
  completeCampaignChallenge,
  enrollCampaignChallenge,
  saveCampaignChallengeLook,
} from "./actions";

import { getCustomersForUser } from "@/lib/customer-context";
import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

const DAY_LABELS = [
  "Day 1",
  "Day 2",
  "Day 3",
  "Day 4",
  "Day 5",
  "Day 6",
  "Day 7",
] as const;

export default async function PrivateOffersPage() {
  const session = await requireSession();
  const supabase = await getSupabaseServerClient();
  const customers = await getCustomersForUser(session.userId);
  const campaignRepo = new CampaignRepository(supabase);
  const retailerRepo = new RetailerRepository(supabase);
  const consentRepo = new CustomerConsentRepository(supabase);
  const styleRepo = new StyleProfileRepository(supabase);
  const productRepo = new ProductRepository(supabase);

  const groups = await Promise.all(
    customers.map(async (customer) => {
      const retailerId = asId<"RetailerId">(customer.retailerId);
      const customerId = asId<"CustomerId">(customer.id);
      const [retailer, campaigns, consent, conceptIds, products, grants] =
        await Promise.all([
          retailerRepo.findById(customer.retailerId),
          campaignRepo.listActiveByRetailer(customer.retailerId),
          consentRepo.getState(retailerId, customerId),
          styleRepo.findInferredConceptIds(retailerId, customerId),
          productRepo.findByRetailer(customer.retailerId as never),
          campaignRepo.listRewardGrantsForCustomer(customer.id),
        ]);
      const profile = await styleRepo.findByCustomer(retailerId, customerId);
      const declared =
        profile?.explicitPreferences.map((pref) => pref.conceptId) ?? [];
      const allConcepts = new Set<string>([...conceptIds, ...declared]);

      const offers: {
        campaign: Campaign;
        explanations: readonly string[];
        visible: boolean;
      }[] = [];
      const challenges: {
        campaign: Campaign;
        enrollment: CampaignChallengeEnrollment | null;
        looks: CampaignChallengeLook[];
        grant?: CampaignRewardGrant;
      }[] = [];

      for (const campaign of campaigns) {
        const rules = await campaignRepo.listAudienceRules(campaign.id);
        const audience = evaluateAudienceRules({
          rules,
          personalizationConsent: consent.personalization.status,
          customerConceptIds: allConcepts,
        });
        if (campaign.kind === "private_offer") {
          offers.push({
            campaign,
            explanations: audience.ok ? audience.matchedExplanations : [],
            visible: audience.ok,
          });
          continue;
        }
        const enrollment = await campaignRepo.findEnrollment(
          campaign.id,
          customer.id,
        );
        const looks = enrollment
          ? await campaignRepo.listLooksForEnrollment(enrollment.id)
          : [];
        const grant = grants.find((row) => row.campaignId === campaign.id);
        challenges.push({
          campaign,
          enrollment,
          looks,
          ...(grant ? { grant } : {}),
        });
      }

      return {
        customer,
        retailer,
        consent,
        offers,
        challenges,
        products: products.filter((product) => product.status === "active"),
        audits: await campaignRepo.listDeliveryAuditsForCustomer(
          customer.id,
          5,
        ),
      };
    }),
  );

  return (
    <div className="customer-page flex flex-col gap-6 bg-black pb-12 text-white">
      <header className="pe-page-head items-end gap-6 pb-3">
        <div>
          <p className="customer-kicker mb-2 text-white/55">
            Invitations from your houses
          </p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.055em] text-white sm:text-6xl">
            Private offers
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Members-only releases and seven-day wardrobe challenges, shown only
            when your consent allows them.
          </p>
        </div>
        <Link
          href="/account"
          className="inline-flex min-h-[52px] items-center rounded-full bg-[#191b1d] px-6 text-sm font-semibold text-white"
        >
          Manage consent
        </Link>
      </header>

      {groups.length === 0 ? (
        <div
          className="pe-card rounded-[32px] bg-[#191b1d] px-6 py-16 text-center"
          role="status"
          data-pe-card
        >
          <p className="text-white/60">No house connections yet.</p>
        </div>
      ) : (
        groups.map(
          ({
            customer,
            retailer,
            consent,
            offers,
            challenges,
            products,
            audits,
          }) => (
            <section key={customer.id} className="flex flex-col gap-4">
              <div
                className="pe-card pe-card-mint rounded-[32px] bg-[#b8e6be] p-7 text-[#181818]"
                data-pe-card
              >
                <h2 className="text-3xl font-semibold tracking-[-0.035em] text-[#181818]">
                  {retailer?.displayName ?? "Your retailer"}
                </h2>
                <p className="mt-2 text-sm text-[#181818]/60">
                  Personalization: {consent.personalization.status}
                  {consent.personalization.status !== "granted" ? (
                    <>
                      {" "}
                      —{" "}
                      <Link
                        href="/account"
                        className="underline underline-offset-2"
                      >
                        manage consent
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>

              <div
                className="pe-card pe-card-blue rounded-[32px] bg-[#aed6e7] p-7 text-[#181818]"
                data-pe-card
              >
                <h3 className="text-2xl font-semibold tracking-[-0.025em] text-[#181818]">
                  Private offers
                </h3>
                {offers.filter((offer) => offer.visible).length === 0 ? (
                  <p role="status" className="mt-3 text-sm text-[#181818]/60">
                    No private offers available for your consented profile right
                    now.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-4">
                    {offers
                      .filter((offer) => offer.visible)
                      .map(({ campaign, explanations }) => (
                        <li
                          key={campaign.id}
                          className="rounded-[22px] bg-[#181818]/[0.07] p-5"
                        >
                          <p className="text-lg font-semibold text-[#181818]">
                            {campaign.title}
                          </p>
                          <p className="mt-2 text-sm text-[#181818]/70">
                            {campaign.summary}
                          </p>
                          <p className="mt-3 text-xs text-[#181818]/55">
                            Why you see this:{" "}
                            {explanations[0] ?? campaign.explanation}
                          </p>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div
                className="pe-card pe-card-lavender rounded-[32px] bg-[#c7c1ef] p-7 text-[#181818]"
                data-pe-card
              >
                <h3 className="text-2xl font-semibold tracking-[-0.025em] text-[#181818]">
                  Seven-day wardrobe
                </h3>
                {challenges.length === 0 ? (
                  <p role="status" className="mt-3 text-sm text-[#181818]/60">
                    No active wardrobe challenges.
                  </p>
                ) : (
                  challenges.map(({ campaign, enrollment, looks, grant }) => {
                    const completeness = challengeCompleteness({ looks });
                    return (
                      <div
                        key={campaign.id}
                        className="mt-4 rounded-[24px] bg-[#181818]/[0.07] p-5"
                      >
                        <p className="text-lg font-semibold text-[#181818]">
                          {campaign.title}
                        </p>
                        <p className="mt-2 text-sm text-[#181818]/70">
                          {campaign.summary}
                        </p>
                        {campaign.rewardKind ? (
                          <p className="mt-3 text-xs text-[#181818]/55">
                            Completion reward:{" "}
                            {campaign.rewardLabel ?? campaign.rewardKind}
                          </p>
                        ) : null}

                        {!enrollment ? (
                          <form
                            action={enrollCampaignChallenge}
                            className="mt-3"
                          >
                            <input
                              type="hidden"
                              name="campaignId"
                              value={campaign.id}
                            />
                            <input
                              type="hidden"
                              name="retailerId"
                              value={customer.retailerId}
                            />
                            <input
                              type="hidden"
                              name="customerId"
                              value={customer.id}
                            />
                            <Button type="submit" size="sm">
                              Begin seven looks
                            </Button>
                          </form>
                        ) : (
                          <div className="mt-4 flex flex-col gap-4">
                            <p className="text-sm text-[#181818]/60">
                              Progress: {completeness.completeDayCount} / 7
                              complete looks
                              {enrollment.status === "completed"
                                ? " · completed"
                                : ""}
                            </p>
                            {grant ? (
                              <p
                                role="status"
                                className="rounded-[18px] bg-[#b8e6be] p-4 text-sm text-[#181818]"
                              >
                                Reward granted: {grant.label}
                                {grant.expiresAt
                                  ? ` · expires ${grant.expiresAt.slice(0, 10)}`
                                  : ""}
                              </p>
                            ) : null}

                            {enrollment.status === "in_progress"
                              ? DAY_LABELS.map((label, index) => {
                                  const dayIndex = index + 1;
                                  const look = looks.find(
                                    (entry) => entry.dayIndex === dayIndex,
                                  );
                                  return (
                                    <details
                                      key={dayIndex}
                                      className="rounded-[20px] bg-white/55 px-4 py-3"
                                      open={dayIndex === 1}
                                    >
                                      <summary className="cursor-pointer text-sm font-semibold text-[#181818]">
                                        {label}
                                        {look &&
                                        isLookComplete({ slots: look.slots })
                                          ? " · complete"
                                          : ""}
                                      </summary>
                                      <form
                                        action={saveCampaignChallengeLook}
                                        className="mt-3 grid gap-2 md:grid-cols-2"
                                      >
                                        <input
                                          type="hidden"
                                          name="enrollmentId"
                                          value={enrollment.id}
                                        />
                                        <input
                                          type="hidden"
                                          name="dayIndex"
                                          value={dayIndex}
                                        />
                                        <label className="flex flex-col gap-1 text-sm md:col-span-2">
                                          Look title
                                          <input
                                            name="title"
                                            required
                                            defaultValue={
                                              look?.title ?? `${label} look`
                                            }
                                            className="rounded border border-[var(--color-stone-200)] px-3 py-2"
                                          />
                                        </label>
                                        {CAMPAIGN_REQUIRED_LOOK_SLOTS.map(
                                          (slotKind) => {
                                            const existing = look?.slots.find(
                                              (slot) =>
                                                slot.slotKind === slotKind,
                                            );
                                            return (
                                              <label
                                                key={slotKind}
                                                className="flex flex-col gap-1 text-sm"
                                              >
                                                {slotKind}
                                                <select
                                                  name={`slot_${slotKind}`}
                                                  required
                                                  defaultValue={
                                                    existing?.productId ?? ""
                                                  }
                                                  className="rounded border border-[var(--color-stone-200)] px-3 py-2"
                                                >
                                                  <option value="">
                                                    Choose catalogue piece
                                                  </option>
                                                  {products.map((product) => (
                                                    <option
                                                      key={product.id}
                                                      value={product.id}
                                                    >
                                                      {product.name}
                                                    </option>
                                                  ))}
                                                </select>
                                              </label>
                                            );
                                          },
                                        )}
                                        <div className="md:col-span-2">
                                          <Button
                                            type="submit"
                                            size="sm"
                                            variant="outline"
                                          >
                                            Save {label}
                                          </Button>
                                        </div>
                                      </form>
                                    </details>
                                  );
                                })
                              : null}

                            {enrollment.status === "in_progress" &&
                            completeness.isComplete ? (
                              <form action={completeCampaignChallenge}>
                                <input
                                  type="hidden"
                                  name="enrollmentId"
                                  value={enrollment.id}
                                />
                                <Button type="submit" size="sm">
                                  Complete and claim reward
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {audits.length > 0 ? (
                <div
                  className="pe-card rounded-[32px] bg-[#191b1d] p-7 text-white"
                  data-pe-card
                >
                  <h3 className="text-lg font-semibold text-white">
                    Recent delivery audit
                  </h3>
                  <ul className="mt-3 space-y-1 text-xs text-white/55">
                    {audits.map((audit) => (
                      <li key={audit.id}>
                        {audit.forDate}: {audit.outcome}
                        {audit.suppressionReason
                          ? ` (${audit.suppressionReason})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ),
        )
      )}
    </div>
  );
}
