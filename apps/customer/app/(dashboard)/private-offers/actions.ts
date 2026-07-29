"use server";

import {
  CampaignRepository,
  CustomerConsentRepository,
  CustomerRepository,
  LoyaltyRepository,
  ProductRepository,
} from "@paon/database";
import {
  asId,
  buildCampaignAudienceExplanation,
  completeWardrobeChallengeInputSchema,
  evaluateCampaignAudience,
  isWardrobeChallengeDayComplete,
  saveWardrobeChallengeDayLookInputSchema,
  startWardrobeChallengeInputSchema,
} from "@paon/domain";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/session";
import { getSupabaseServerClient } from "@/lib/supabase-server";

async function assertCustomerOwnership(customerId: string, userId: string) {
  const supabase = await getSupabaseServerClient();
  const customers = await new CustomerRepository(supabase).findByUserId(
    asId<"UserId">(userId),
  );
  if (!customers.some((customer) => customer.id === customerId)) {
    throw new Error("Not authorized");
  }
  return supabase;
}

export async function startChallenge(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = startWardrobeChallengeInputSchema.parse({
    retailerId: formData.get("retailerId"),
    customerId: formData.get("customerId"),
    campaignId: formData.get("campaignId"),
  });
  const supabase = await assertCustomerOwnership(
    parsed.customerId,
    session.userId,
  );
  await new CampaignRepository(supabase).startWardrobeChallenge(parsed);
  revalidatePath("/private-offers");
}

export async function saveDayLook(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = saveWardrobeChallengeDayLookInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
    dayIndex: Number(formData.get("dayIndex")),
    slots: {
      jacket: formData.get("jacket")?.toString(),
      trousers: formData.get("trousers")?.toString(),
      shirt: formData.get("shirt")?.toString(),
      shoes: formData.get("shoes")?.toString(),
    },
  });
  const supabase = await getSupabaseServerClient();
  await assertCustomerOwnership(
    String(formData.get("customerId")),
    session.userId,
  );
  await new CampaignRepository(supabase).saveDayLook(parsed);
  revalidatePath("/private-offers");
}

export async function completeChallenge(formData: FormData): Promise<void> {
  const session = await requireSession();
  const parsed = completeWardrobeChallengeInputSchema.parse({
    enrollmentId: formData.get("enrollmentId"),
  });
  const supabase = await getSupabaseServerClient();
  await assertCustomerOwnership(
    String(formData.get("customerId")),
    session.userId,
  );
  await new CampaignRepository(supabase).completeChallenge(parsed.enrollmentId);
  revalidatePath("/private-offers");
}

export type PrivateOfferGroup = Awaited<
  ReturnType<typeof loadPrivateOfferGroups>
>[number];

export async function loadPrivateOfferGroups(userId: string) {
  const supabase = await getSupabaseServerClient();
  const repo = new CampaignRepository(supabase);
  const consentRepo = new CustomerConsentRepository(supabase);
  const loyaltyRepo = new LoyaltyRepository(supabase);
  const productRepo = new ProductRepository(supabase);
  const customers = await new CustomerRepository(supabase).findByUserId(
    asId<"UserId">(userId),
  );

  return Promise.all(
    customers.map(async (customer) => {
      const [offers, challenges, consent, account] = await Promise.all([
        repo.listActiveForRetailer(customer.retailerId, "private_offer"),
        repo.listActiveForRetailer(customer.retailerId, "seven_day_wardrobe"),
        consentRepo.getState(
          asId<"RetailerId">(customer.retailerId),
          asId<"CustomerId">(customer.id),
        ),
        loyaltyRepo.findAccountByCustomer(customer.id),
      ]);
      const products = await productRepo.findByRetailer(
        customer.retailerId as never,
      );
      const activeProducts = products.filter(
        (product) => product.status === "active",
      );
      const nowUtcIso = new Date().toISOString();
      const audienceContext = {
        ...(account ? { customerTier: account.tier } : {}),
        nowUtcIso,
      };

      const eligibleOffers = offers.filter(
        (campaign) =>
          evaluateCampaignAudience({
            campaign,
            personalizationStatus: consent.personalization.status,
            ...audienceContext,
          }).ok,
      );

      const eligibleChallenges = challenges.filter(
        (campaign) =>
          evaluateCampaignAudience({
            campaign,
            personalizationStatus: consent.personalization.status,
            ...audienceContext,
          }).ok,
      );

      const enrollments = await repo.listEnrollmentsForCustomer(customer.id);
      const rewards = await repo.listRewardGrantsForCustomer(customer.id);

      const enrollmentDetails = await Promise.all(
        enrollments.map(async (enrollment) => ({
          enrollment,
          dayLooks: await repo.listDayLooks(enrollment.id),
        })),
      );

      return {
        customerId: customer.id,
        retailerId: customer.retailerId,
        explanation: buildCampaignAudienceExplanation({
          requiresPersonalizationConsent: true,
          personalizationStatus: consent.personalization.status,
          ...(account ? { customerTier: account.tier } : {}),
          targetLabels: [],
        }),
        eligibleOffers,
        eligibleChallenges,
        enrollmentDetails,
        rewards,
        activeProducts,
        isWardrobeChallengeDayComplete,
      };
    }),
  );
}
