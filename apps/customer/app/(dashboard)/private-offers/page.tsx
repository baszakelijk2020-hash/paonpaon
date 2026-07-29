import {
  CampaignRepository,
  CustomerConsentRepository,
  CustomerRepository,
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
  const customers = await new CustomerRepository(supabase).findByUserId(
    session.userId,
  );
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
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl text-[var(--color-stone-900)]">
          Private offers
        </h1>
        <p className="text-sm text-[var(--color-stone-500)]">
          Members-only releases and seven-day wardrobe challenges from your
          houses. Audience rules are consent-aware and explained — marketing
          consent is never reused for personalization.
        </p>
      </div>

      {groups.length === 0 ? (
        <div
          className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-stone-300)] px-6 py-16 text-center"
          role="status"
        >
          <p className="text-[var(--color-stone-600)]">
            No house connections yet.
          </p>
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
            <section
              key={customer.id}
              className="rounded-[var(--radius-md)] border border-[var(--color-stone-200)] bg-white px-5 py-5"
            >
              <h2 className="font-display text-2xl text-[var(--color-stone-900)]">
                {retailer?.displayName ?? "Your house"}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-stone-500)]">
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

              <div className="mt-6">
                <h3 className="font-display text-lg text-[var(--color-stone-900)]">
                  Private offers
                </h3>
                {offers.filter((offer) => offer.visible).length === 0 ? (
                  <p
                    role="status"
                    className="mt-2 text-sm text-[var(--color-stone-500)]"
                  >
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
                          className="border-t border-[var(--color-stone-100)] pt-4 first:border-t-0 first:pt-0"
                        >
                          <p className="text-base text-[var(--color-stone-900)]">
                            {campaign.title}
                          </p>
                          <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                            {campaign.summary}
                          </p>
                          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
                            Why you see this:{" "}
                            {explanations[0] ?? campaign.explanation}
                          </p>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="mt-8">
                <h3 className="font-display text-lg text-[var(--color-stone-900)]">
                  Seven-day wardrobe
                </h3>
                {challenges.length === 0 ? (
                  <p
                    role="status"
                    className="mt-2 text-sm text-[var(--color-stone-500)]"
                  >
                    No active wardrobe challenges.
                  </p>
                ) : (
                  challenges.map(({ campaign, enrollment, looks, grant }) => {
                    const completeness = challengeCompleteness({ looks });
                    return (
                      <div
                        key={campaign.id}
                        className="mt-4 border-t border-[var(--color-stone-100)] pt-4"
                      >
                        <p className="text-base text-[var(--color-stone-900)]">
                          {campaign.title}
                        </p>
                        <p className="mt-1 text-sm text-[var(--color-stone-600)]">
                          {campaign.summary}
                        </p>
                        {campaign.rewardKind ? (
                          <p className="mt-2 text-xs text-[var(--color-stone-500)]">
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
                            <p className="text-sm text-[var(--color-stone-500)]">
                              Progress: {completeness.completeDayCount} / 7
                              complete looks
                              {enrollment.status === "completed"
                                ? " · completed"
                                : ""}
                            </p>
                            {grant ? (
                              <p
                                role="status"
                                className="text-sm text-[var(--color-stone-800)]"
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
                                      className="rounded border border-[var(--color-stone-200)] px-4 py-3"
                                      open={dayIndex === 1}
                                    >
                                      <summary className="cursor-pointer text-sm text-[var(--color-stone-900)]">
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
                <div className="mt-8 border-t border-[var(--color-stone-100)] pt-4">
                  <h3 className="text-sm font-medium text-[var(--color-stone-900)]">
                    Recent delivery audit
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-[var(--color-stone-500)]">
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
