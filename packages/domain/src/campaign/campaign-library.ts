/**
 * Versioned campaign library (CMP-101 / PHASE 10.1).
 * Library version snapshots are immutable; retailer copies pin a version id
 * so later library publishes do not mutate active campaigns.
 */

export const CAMPAIGN_LIBRARY_PROJECTOR_VERSION = "campaign-library-v1";

export const CAMPAIGN_LIBRARY_KEYS = [
  "private_offer_member_fabric",
  "seven_day_wardrobe_v1",
  "honeymoon_phase_v1",
] as const;

export type CampaignLibraryKey = (typeof CAMPAIGN_LIBRARY_KEYS)[number];

export interface CampaignLibrarySnapshot {
  readonly versionLabel: string;
  readonly kind: "private_offer" | "wardrobe_challenge" | "order_journey";
  readonly title: string;
  readonly summary: string;
  readonly prerequisites: readonly string[];
  readonly placementHints: readonly string[];
  readonly staffMission: string;
  readonly outcomeMetrics: readonly string[];
  readonly audienceTemplate: Readonly<Record<string, string>>;
}

export interface CampaignLibraryEntry {
  readonly id: string;
  readonly key: CampaignLibraryKey;
  readonly displayName: string;
}

export interface CampaignLibraryVersion {
  readonly id: string;
  readonly entryId: string;
  readonly versionNumber: number;
  readonly status: "draft" | "active" | "retired";
  readonly snapshot: CampaignLibrarySnapshot;
  readonly activatedAt?: string;
}

export const MEMBER_FABRIC_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "private-offer-member-fabric-v1",
  kind: "private_offer",
  title: "Member fabric private offer",
  summary:
    "Invite consented members to a short private fabric offer with advisor follow-up.",
  prerequisites: [
    "personalization_consent",
    "active_catalogue_products",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "for_you"],
  staffMission: "Prepare two fabric options and confirm fit notes before send.",
  outcomeMetrics: [
    "eligible",
    "prepared",
    "opened",
    "appointment_booked",
    "converted",
  ],
  audienceTemplate: {
    consent: "personalization",
    lifecycle: "returning_or_vip",
  },
};

export const SEVEN_DAY_WARDROBE_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "seven-day-wardrobe-v1",
  kind: "wardrobe_challenge",
  title: "Seven-Day Wardrobe",
  summary:
    "Owned-first seven complete looks with cited gaps and restrained completion reward.",
  prerequisites: [
    "personalization_consent",
    "wardrobe_items_or_catalogue",
    "advisor_coverage",
  ],
  placementHints: ["private_offers", "morning_routine", "wardrobe"],
  staffMission:
    "Review proposed owned-first looks, confirm cited gaps, and coach alternatives.",
  outcomeMetrics: [
    "enrolled",
    "days_complete",
    "gaps_cited",
    "reward_granted",
    "appointment_booked",
  ],
  audienceTemplate: {
    consent: "personalization",
    lifecycle: "active_relationship",
  },
};

export const HONEYMOON_PHASE_LIBRARY_V1: CampaignLibrarySnapshot = {
  versionLabel: "honeymoon-phase-v1",
  kind: "order_journey",
  title: "Honeymoon Phase",
  summary:
    "Transparent order-to-delivery tracker with preparation, collection, and aftercare actions.",
  prerequisites: [
    "personalization_consent",
    "order_placed",
    "advisor_coverage",
  ],
  placementHints: ["order_detail", "advisor_today"],
  staffMission:
    "Prepare collection, confirm lead-time truth, and respect contact-pressure limits.",
  outcomeMetrics: [
    "enrolled",
    "preparation_complete",
    "collected",
    "aftercare_viewed",
    "repeat_purchase",
  ],
  audienceTemplate: {
    consent: "personalization",
    trigger: "order_placed",
  },
};

export function cloneLibrarySnapshotForRetailer(
  snapshot: CampaignLibrarySnapshot,
): {
  readonly title: string;
  readonly summary: string;
  readonly kind: CampaignLibrarySnapshot["kind"];
  readonly pinnedVersionLabel: string;
} {
  return {
    title: snapshot.title,
    summary: snapshot.summary,
    kind: snapshot.kind,
    pinnedVersionLabel: snapshot.versionLabel,
  };
}

/**
 * Publishing a new library version must not change a pinned copy.
 */
export function pinnedCopySurvivesLibraryPublish(args: {
  readonly pinnedSnapshot: CampaignLibrarySnapshot;
  readonly newLibrarySnapshot: CampaignLibrarySnapshot;
}): boolean {
  return (
    args.pinnedSnapshot.versionLabel !== args.newLibrarySnapshot.versionLabel &&
    args.pinnedSnapshot.versionLabel === args.pinnedSnapshot.versionLabel
  );
}

export function emptyPrerequisitesBlockActivation(
  snapshot: CampaignLibrarySnapshot,
  satisfied: ReadonlySet<string>,
): readonly string[] {
  return snapshot.prerequisites.filter((key) => !satisfied.has(key));
}
