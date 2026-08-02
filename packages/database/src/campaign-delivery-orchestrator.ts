import {
  asId,
  buildCampaignDeliveryNotification,
  evaluateCampaignDelivery,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import { CampaignRepository } from "./repositories/campaign-repository";
import { CustomerConsentRepository } from "./repositories/customer-consent-repository";
import { PlatformModuleRepository } from "./repositories/platform-module-repository";
import { StyleProfileRepository } from "./repositories/style-profile-repository";

/**
 * Enqueues private-offer delivery for active campaigns against consented
 * audiences. Does not require Resend — notifications are created; email
 * drain remains separate. Marketing consent is never consulted.
 */
export async function orchestrateCampaignDeliveries(
  admin: PaonSupabaseClient,
  nowUtcIso = new Date().toISOString(),
): Promise<{
  readonly considered: number;
  readonly queued: number;
  readonly skipped: number;
  readonly failed: number;
}> {
  const campaignRepo = new CampaignRepository(admin);
  const consentRepo = new CustomerConsentRepository(admin);
  const styleRepo = new StyleProfileRepository(admin);
  const moduleRepo = new PlatformModuleRepository(admin);
  const offers = await campaignRepo.listActivePrivateOffers();
  const moduleEnabledByRetailer = new Map<RetailerId, boolean>();

  let considered = 0;
  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const campaign of offers) {
    const retailerId = asId<"RetailerId">(campaign.retailerId);
    let moduleEnabled = moduleEnabledByRetailer.get(retailerId);
    if (moduleEnabled === undefined) {
      moduleEnabled = await moduleRepo.jobEnabled({
        retailerId,
        jobKey: "campaign_activation",
      });
      moduleEnabledByRetailer.set(retailerId, moduleEnabled);
    }
    if (!moduleEnabled) continue;

    const rules = await campaignRepo.listAudienceRules(campaign.id);
    const customers = await campaignRepo.listCustomersForRetailer(
      campaign.retailerId,
    );

    for (const customer of customers) {
      considered += 1;
      try {
        const retailerId = asId<"RetailerId">(campaign.retailerId);
        const customerId = asId<"CustomerId">(customer.id);
        const consent = await consentRepo.getState(retailerId, customerId);
        const conceptIds = await styleRepo.findInferredConceptIds(
          retailerId,
          customerId,
        );
        const profile = await styleRepo.findByCustomer(retailerId, customerId);
        const declaredIds =
          profile?.explicitPreferences.map((pref) => pref.conceptId) ?? [];
        const allConcepts = new Set<string>([...conceptIds, ...declaredIds]);

        const probe = evaluateCampaignDelivery({
          campaign,
          rules,
          personalizationConsent: consent.personalization.status,
          customerConceptIds: allConcepts,
          nowUtcIso,
          alreadyDeliveredForDate: false,
        });
        const already = await campaignRepo.hasSuccessfulDelivery(
          campaign.id,
          customer.id,
          probe.forDate,
        );
        const decision = evaluateCampaignDelivery({
          campaign,
          rules,
          personalizationConsent: consent.personalization.status,
          customerConceptIds: allConcepts,
          nowUtcIso,
          alreadyDeliveredForDate: already,
        });

        if (!decision.ok) {
          await campaignRepo.recordDeliveryAudit({
            campaignId: campaign.id,
            retailerId: campaign.retailerId,
            customerId: customer.id,
            forDate: decision.forDate,
            outcome: decision.outcome,
            scheduledFor: nowUtcIso,
            personalizationConsent: consent.personalization.status,
            ...(decision.suppressionReason
              ? { suppressionReason: decision.suppressionReason }
              : {}),
            ...(decision.explanation
              ? { explanation: decision.explanation }
              : {}),
          });
          skipped += 1;
          continue;
        }

        const note = buildCampaignDeliveryNotification({
          title: campaign.title,
          forDate: decision.forDate,
          explanation: decision.matchedExplanations[0] ?? campaign.explanation,
        });
        const notificationId = await campaignRepo.enqueueDeliveryNotification({
          retailerId: campaign.retailerId,
          customerId: customer.id,
          title: note.title,
          body: note.body,
          actionHref: note.actionHref,
          channel: "in_app",
        });
        await campaignRepo.recordDeliveryAudit({
          campaignId: campaign.id,
          retailerId: campaign.retailerId,
          customerId: customer.id,
          forDate: decision.forDate,
          outcome: "queued_in_app",
          scheduledFor: nowUtcIso,
          personalizationConsent: consent.personalization.status,
          explanation: decision.matchedExplanations.join(" "),
          notificationId,
        });
        queued += 1;
      } catch {
        failed += 1;
      }
    }
  }

  return { considered, queued, skipped, failed };
}
