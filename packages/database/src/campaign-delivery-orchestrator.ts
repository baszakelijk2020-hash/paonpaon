import {
  asId,
  buildPrivateOfferNotification,
  evaluatePrivateOfferDelivery,
} from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import { CampaignRepository } from "./repositories/campaign-repository";
import { CustomerConsentRepository } from "./repositories/customer-consent-repository";
import { LoyaltyRepository } from "./repositories/loyalty-repository";

/**
 * Enqueues private-offer in-app notifications for eligible customers.
 * Requires personalization consent; never reuses marketing consent.
 */
export async function orchestrateCampaignDeliveries(
  admin: PaonSupabaseClient,
  nowUtcIso = new Date().toISOString(),
): Promise<{
  readonly considered: number;
  readonly delivered: number;
  readonly skipped: number;
  readonly failed: number;
}> {
  const campaignRepo = new CampaignRepository(admin);
  const consentRepo = new CustomerConsentRepository(admin);
  const loyaltyRepo = new LoyaltyRepository(admin);

  const { data: campaigns, error } = await admin
    .from("retailer_campaigns")
    .select("*")
    .eq("kind", "private_offer")
    .eq("active", true)
    .eq("paused", false);
  if (error) throw error;

  let considered = 0;
  let delivered = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of campaigns ?? []) {
    const campaign = {
      active: row.active,
      paused: row.paused,
      scheduleFrequency: row.schedule_frequency as "daily" | "weekly",
      timezone: row.timezone,
      requiresPersonalizationConsent: row.requires_personalization_consent,
      ...(row.minimum_loyalty_tier
        ? {
            minimumLoyaltyTier: row.minimum_loyalty_tier as
              "member" | "silver" | "gold" | "platinum",
          }
        : {}),
      ...(row.starts_at ? { startsAt: row.starts_at } : {}),
      ...(row.ends_at ? { endsAt: row.ends_at } : {}),
    };

    const { data: customers, error: customersError } = await admin
      .from("customers")
      .select("id, retailer_id")
      .eq("retailer_id", row.retailer_id)
      .is("deleted_at", null);
    if (customersError) {
      failed += 1;
      continue;
    }

    for (const customer of customers ?? []) {
      considered += 1;
      try {
        const consent = await consentRepo.getState(
          asId<"RetailerId">(customer.retailer_id),
          asId<"CustomerId">(customer.id),
        );
        const account = await loyaltyRepo.findAccountByCustomer(
          asId<"CustomerId">(customer.id),
        );

        const probe = evaluatePrivateOfferDelivery({
          campaign,
          personalizationStatus: consent.personalization.status,
          ...(account ? { customerTier: account.tier } : {}),
          nowUtcIso,
          alreadyDeliveredForDate: false,
        });
        const forDate = probe.ok ? probe.forDate : probe.forDate;

        const already = await campaignRepo.hasSuccessfulDelivery(
          customer.id,
          row.id,
          forDate,
        );

        const decision = evaluatePrivateOfferDelivery({
          campaign,
          personalizationStatus: consent.personalization.status,
          ...(account ? { customerTier: account.tier } : {}),
          nowUtcIso,
          alreadyDeliveredForDate: already,
        });

        if (!decision.ok) {
          await campaignRepo.recordDeliveryAudit({
            retailerId: customer.retailer_id,
            customerId: customer.id,
            campaignId: row.id,
            forDate: decision.forDate,
            outcome: decision.outcome,
            scheduledFor: nowUtcIso,
            ...(decision.suppressionReason
              ? { suppressionReason: decision.suppressionReason }
              : {}),
          });
          skipped += 1;
          continue;
        }

        const note = buildPrivateOfferNotification({
          title: row.title,
          forDate: decision.forDate,
        });
        const notificationId = await campaignRepo.enqueueOfferNotification({
          retailerId: customer.retailer_id,
          customerId: customer.id,
          campaignId: row.id,
          title: note.title,
          body: note.body,
          actionHref: note.actionHref,
        });
        await campaignRepo.recordDeliveryAudit({
          retailerId: customer.retailer_id,
          customerId: customer.id,
          campaignId: row.id,
          forDate: decision.forDate,
          outcome: "delivered",
          scheduledFor: nowUtcIso,
          notificationId,
        });
        delivered += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { considered, delivered, skipped, failed };
}
