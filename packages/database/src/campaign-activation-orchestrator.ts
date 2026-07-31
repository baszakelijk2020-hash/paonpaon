import {
  asId,
  buildCampaignMissionOpportunity,
  evaluateAudienceRules,
  evaluateCampaignRehearsal,
  type CampaignRehearsalReport,
  type RetailerId,
} from "@paon/domain";

import type { PaonSupabaseClient } from "./client-type";
import type { Json } from "./generated/database.types";
import { CampaignRepository } from "./repositories/campaign-repository";
import { ClientelingOpportunityRepository } from "./repositories/clienteling-opportunity-repository";
import { CustomerConsentRepository } from "./repositories/customer-consent-repository";
import { StyleProfileRepository } from "./repositories/style-profile-repository";

/** Contact-pressure window mirrors clienteling-opportunity.ts's own default. */
const PRESSURE_WINDOW_DAYS = 14;

async function gatherCandidates(
  client: PaonSupabaseClient,
  args: {
    readonly retailerId: RetailerId;
    readonly campaignId: string;
    readonly now: string;
  },
) {
  const campaignRepo = new CampaignRepository(client);
  const consentRepo = new CustomerConsentRepository(client);
  const styleRepo = new StyleProfileRepository(client);
  const opportunityRepo = new ClientelingOpportunityRepository(client);

  const [rules, customers] = await Promise.all([
    campaignRepo.listAudienceRules(args.campaignId),
    campaignRepo.listCustomersForRetailer(args.retailerId),
  ]);

  const pressureWindowStart = new Date(
    Date.parse(args.now) - PRESSURE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  return Promise.all(
    customers.map(async (customer) => {
      const customerId = asId<"CustomerId">(customer.id);
      const [consent, inferredConceptIds, profile, recentOpportunities] =
        await Promise.all([
          consentRepo.getState(args.retailerId, customerId),
          styleRepo.findInferredConceptIds(args.retailerId, customerId),
          styleRepo.findByCustomer(args.retailerId, customerId),
          opportunityRepo.listForCustomer(args.retailerId, customerId, 50),
        ]);
      const declaredConceptIds =
        profile?.explicitPreferences.map((pref) => pref.conceptId) ?? [];
      const allConceptIds = new Set<string>([
        ...inferredConceptIds,
        ...declaredConceptIds,
      ]);

      const audienceMatch = evaluateAudienceRules({
        rules,
        personalizationConsent: consent.personalization.status,
        customerConceptIds: allConceptIds,
      });

      const recentTouchCount = recentOpportunities.filter(
        (opportunity) =>
          Date.parse(opportunity.createdAt) >=
            Date.parse(pressureWindowStart) &&
          opportunity.status !== "expired" &&
          opportunity.status !== "incorrect",
      ).length;

      return {
        customerId,
        audienceMatch: audienceMatch.ok
          ? ({ ok: true } as const)
          : { ok: false as const, reason: audienceMatch.explanation },
        recentTouchCount,
      };
    }),
  );
}

/**
 * Read-only preview of who a campaign activation would reach (PHASE 10.1
 * acceptance: "rehearsed with prerequisites/exclusions/contact pressure").
 * Writes nothing — a retailer can rehearse the same campaign as many times
 * as they like before committing to activation.
 */
export async function rehearseCampaignActivation(
  client: PaonSupabaseClient,
  args: {
    readonly retailerId: RetailerId;
    readonly campaignId: string;
    readonly now?: string;
  },
): Promise<CampaignRehearsalReport> {
  const now = args.now ?? new Date().toISOString();
  const candidates = await gatherCandidates(client, {
    retailerId: args.retailerId,
    campaignId: args.campaignId,
    now,
  });
  return evaluateCampaignRehearsal({ candidates, now });
}

export interface ActivateCampaignResult {
  readonly missionsCreated: number;
  readonly report: CampaignRehearsalReport;
}

/**
 * Activates a campaign into shared staff missions (PHASE 10.1): re-runs the
 * identical rehearsal logic so activation can never silently reach a
 * different audience than the retailer last previewed, then creates one
 * clienteling_opportunities mission per eligible customer. Idempotent via
 * the (campaign_id, customer_id) unique index — re-running activation for
 * customers who already have a mission is a no-op for them, not a
 * duplicate.
 *
 * Customer placement itself needs no separate write: apps/customer's
 * private-offers page already lists any campaign with status "active" whose
 * audience rules the customer matches (evaluateAudienceRules, same
 * function). Setting the campaign to "active" is what makes the *customer*
 * side live; this function is what makes the *staff* side live.
 */
export async function activateCampaignToStaffMissions(
  client: PaonSupabaseClient,
  args: {
    readonly retailerId: RetailerId;
    readonly campaignId: string;
    readonly campaignTitle: string;
    readonly staffMission: string;
    readonly now?: string;
  },
): Promise<ActivateCampaignResult> {
  const now = args.now ?? new Date().toISOString();
  const candidates = await gatherCandidates(client, {
    retailerId: args.retailerId,
    campaignId: args.campaignId,
    now,
  });
  const report = evaluateCampaignRehearsal({ candidates, now });

  const eligibleCustomerIds = report.outcomes
    .filter((outcome) => outcome.result === "eligible")
    .map((outcome) => outcome.customerId);

  if (eligibleCustomerIds.length === 0) {
    return { missionsCreated: 0, report };
  }

  const rows = eligibleCustomerIds.map((customerId) => {
    const mission = buildCampaignMissionOpportunity({
      retailerId: args.retailerId,
      customerId,
      campaignId: args.campaignId,
      campaignTitle: args.campaignTitle,
      staffMission: args.staffMission,
      now,
    });
    return {
      retailer_id: mission.retailerId,
      customer_id: mission.customerId,
      campaign_id: args.campaignId,
      opportunity_type: mission.type,
      why_now: mission.whyNow,
      suggested_action: mission.suggestedAction,
      channel: mission.channel,
      priority: mission.priority,
      confidence: mission.confidence,
      status: mission.status,
      contact_pressure: mission.contactPressure,
      evidence: mission.evidence as unknown as Json,
      ...(mission.expiresAt ? { expires_at: mission.expiresAt } : {}),
      projector_version: mission.projectorVersion,
    };
  });

  const { error, count } = await client
    .from("clienteling_opportunities")
    .upsert(rows, {
      onConflict: "campaign_id,customer_id",
      ignoreDuplicates: true,
      count: "exact",
    });
  if (error) throw error;

  return { missionsCreated: count ?? rows.length, report };
}
