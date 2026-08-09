/**
 * Virtual try-on authorization and usage-ledger contract (PHASE 17.10 /
 * ADV-110). This module owns commercial and consent-aware policy decisions;
 * provider SDKs and generation execution stay behind `@paon/ai`.
 *
 * No default allowance or price is encoded here. A retailer must configure
 * explicit limits and a provider estimate before a cache miss can be
 * authorized. Cached output remains subject to tenancy, module, eligibility,
 * and consent checks, but consumes no generation quota or budget.
 */

import type {
  CampaignId,
  CustomerId,
  RetailerBranchId,
  RetailerId,
  StaffId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";

export const VIRTUAL_TRY_ON_MEDIA_KINDS = ["image", "video"] as const;
export type VirtualTryOnMediaKind = (typeof VIRTUAL_TRY_ON_MEDIA_KINDS)[number];

export const VIRTUAL_TRY_ON_QUALITY_LEVELS = [
  "preview",
  "premium",
  "video",
] as const;
export type VirtualTryOnQualityLevel =
  (typeof VIRTUAL_TRY_ON_QUALITY_LEVELS)[number];

export const VIRTUAL_TRY_ON_TRIGGERS = [
  "customer_try_on",
  "morning_routine",
  "advisor_selection",
  "appointment_preparation",
  "saved_look",
  "shared_look",
  "animation_request",
] as const;
export type VirtualTryOnTrigger = (typeof VIRTUAL_TRY_ON_TRIGGERS)[number];

export const VIRTUAL_TRY_ON_LEDGER_STATUSES = [
  "denied",
  "authorized",
  "cache_hit",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type VirtualTryOnLedgerStatus =
  (typeof VIRTUAL_TRY_ON_LEDGER_STATUSES)[number];

export const VIRTUAL_TRY_ON_DENIAL_REASONS = [
  "module_not_active",
  "retailer_disabled",
  "media_not_allowed",
  "customer_not_eligible",
  "customer_disabled",
  "image_processing_consent_missing",
  "portrait_storage_consent_missing",
  "invalid_policy",
  "invalid_provider_estimate",
  "daily_quota_exhausted",
  "weekly_quota_exhausted",
  "monthly_quota_exhausted",
  "customer_budget_exhausted",
  "retailer_budget_exhausted",
  "campaign_budget_unavailable",
  "campaign_budget_exhausted",
  "commercial_justification_missing",
] as const;
export type VirtualTryOnDenialReason =
  (typeof VIRTUAL_TRY_ON_DENIAL_REASONS)[number];

export type VirtualTryOnModuleState =
  "off" | "preview" | "active" | "suspended";

export interface VirtualTryOnUsagePolicy {
  readonly enabled: boolean;
  readonly currency: Money["currency"];
  readonly monthlyBudgetMinorUnits: number;
  readonly perCustomerMonthlyBudgetMinorUnits: number;
  readonly maxCustomerGenerationsPerDay: number;
  readonly maxCustomerGenerationsPerWeek: number;
  readonly maxCustomerGenerationsPerMonth: number;
  readonly allowImage: boolean;
  readonly allowVideo: boolean;
}

export interface VirtualTryOnCustomerAuthorization {
  readonly eligible: boolean;
  readonly enabled: boolean;
  readonly imageProcessingConsent: "granted" | "denied" | "withdrawn";
  readonly portraitStorageConsent: "granted" | "denied" | "withdrawn";
}

export interface VirtualTryOnUsageWindow {
  readonly customerGenerationsToday: number;
  readonly customerGenerationsThisWeek: number;
  readonly customerGenerationsThisMonth: number;
  readonly customerSpendThisMonthMinorUnits: number;
  readonly retailerSpendThisMonthMinorUnits: number;
}

export interface VirtualTryOnCampaignBudget {
  readonly campaignId: CampaignId | string;
  readonly currency: Money["currency"];
  readonly monthlyBudgetMinorUnits: number;
  readonly spentThisMonthMinorUnits: number;
}

export interface EvaluateVirtualTryOnAuthorizationInput {
  readonly moduleState: VirtualTryOnModuleState;
  readonly mediaKind: VirtualTryOnMediaKind;
  readonly persistPortrait: boolean;
  readonly policy: VirtualTryOnUsagePolicy;
  readonly customer: VirtualTryOnCustomerAuthorization;
  readonly usage: VirtualTryOnUsageWindow;
  readonly providerEstimate: Money;
  readonly cacheHit: boolean;
  readonly commerciallyJustified: boolean;
  readonly campaign?: VirtualTryOnCampaignBudget;
  readonly campaignRequired?: boolean;
}

export type VirtualTryOnAuthorizationDecision =
  | {
      readonly allowed: false;
      readonly reason: VirtualTryOnDenialReason;
      readonly reserve: Money;
    }
  | {
      readonly allowed: true;
      readonly disposition: "cache_hit" | "generate";
      readonly reserve: Money;
    };

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function zero(currency: Money["currency"]): Money {
  return { amountMinorUnits: 0, currency };
}

function denied(
  reason: VirtualTryOnDenialReason,
  currency: Money["currency"],
): VirtualTryOnAuthorizationDecision {
  return { allowed: false, reason, reserve: zero(currency) };
}

function hasValidPolicyNumbers(
  policy: VirtualTryOnUsagePolicy,
  usage: VirtualTryOnUsageWindow,
  campaign?: VirtualTryOnCampaignBudget,
): boolean {
  const values = [
    policy.monthlyBudgetMinorUnits,
    policy.perCustomerMonthlyBudgetMinorUnits,
    policy.maxCustomerGenerationsPerDay,
    policy.maxCustomerGenerationsPerWeek,
    policy.maxCustomerGenerationsPerMonth,
    usage.customerGenerationsToday,
    usage.customerGenerationsThisWeek,
    usage.customerGenerationsThisMonth,
    usage.customerSpendThisMonthMinorUnits,
    usage.retailerSpendThisMonthMinorUnits,
    ...(campaign
      ? [campaign.monthlyBudgetMinorUnits, campaign.spentThisMonthMinorUnits]
      : []),
  ];
  return values.every(isNonNegativeSafeInteger);
}

/**
 * Fail-closed authorization for one provider generation. The result reserves
 * the provider estimate only; actual and marked-up costs belong in the
 * append-only usage ledger after provider settlement.
 */
export function evaluateVirtualTryOnAuthorization(
  input: EvaluateVirtualTryOnAuthorizationInput,
): VirtualTryOnAuthorizationDecision {
  const currency = input.policy.currency;

  if (input.moduleState !== "active") {
    return denied("module_not_active", currency);
  }
  if (!input.policy.enabled) return denied("retailer_disabled", currency);
  if (
    (input.mediaKind === "image" && !input.policy.allowImage) ||
    (input.mediaKind === "video" && !input.policy.allowVideo)
  ) {
    return denied("media_not_allowed", currency);
  }
  if (!input.customer.eligible) {
    return denied("customer_not_eligible", currency);
  }
  if (!input.customer.enabled) return denied("customer_disabled", currency);
  if (input.customer.imageProcessingConsent !== "granted") {
    return denied("image_processing_consent_missing", currency);
  }
  if (
    input.persistPortrait &&
    input.customer.portraitStorageConsent !== "granted"
  ) {
    return denied("portrait_storage_consent_missing", currency);
  }
  if (!hasValidPolicyNumbers(input.policy, input.usage, input.campaign)) {
    return denied("invalid_policy", currency);
  }
  if (
    !isNonNegativeSafeInteger(input.providerEstimate.amountMinorUnits) ||
    input.providerEstimate.currency !== currency
  ) {
    return denied("invalid_provider_estimate", currency);
  }

  // Reusing an identical authorized result is cost level 1: it must still
  // pass identity/consent checks above, but it is not a new generation and
  // therefore consumes no generation quota or money budget.
  if (input.cacheHit) {
    return { allowed: true, disposition: "cache_hit", reserve: zero(currency) };
  }

  if (
    input.usage.customerGenerationsToday >=
    input.policy.maxCustomerGenerationsPerDay
  ) {
    return denied("daily_quota_exhausted", currency);
  }
  if (
    input.usage.customerGenerationsThisWeek >=
    input.policy.maxCustomerGenerationsPerWeek
  ) {
    return denied("weekly_quota_exhausted", currency);
  }
  if (
    input.usage.customerGenerationsThisMonth >=
    input.policy.maxCustomerGenerationsPerMonth
  ) {
    return denied("monthly_quota_exhausted", currency);
  }

  const estimated = input.providerEstimate.amountMinorUnits;
  if (
    input.usage.customerSpendThisMonthMinorUnits + estimated >
    input.policy.perCustomerMonthlyBudgetMinorUnits
  ) {
    return denied("customer_budget_exhausted", currency);
  }
  if (
    input.usage.retailerSpendThisMonthMinorUnits + estimated >
    input.policy.monthlyBudgetMinorUnits
  ) {
    return denied("retailer_budget_exhausted", currency);
  }

  if (input.campaignRequired && !input.campaign) {
    return denied("campaign_budget_unavailable", currency);
  }
  if (input.campaign) {
    if (input.campaign.currency !== currency) {
      return denied("invalid_policy", currency);
    }
    if (
      input.campaign.spentThisMonthMinorUnits + estimated >
      input.campaign.monthlyBudgetMinorUnits
    ) {
      return denied("campaign_budget_exhausted", currency);
    }
  }

  if (!input.commerciallyJustified) {
    return denied("commercial_justification_missing", currency);
  }

  return {
    allowed: true,
    disposition: "generate",
    reserve: input.providerEstimate,
  };
}

/**
 * Provider-neutral persisted usage shape. Input/output asset identifiers are
 * PAON-controlled references, never vendor payloads or public URLs.
 */
export interface VirtualTryOnUsageLedgerEntry {
  readonly id: string;
  readonly retailerId: RetailerId;
  readonly storeId?: RetailerBranchId;
  readonly customerId: CustomerId;
  readonly requestedByStaffId?: StaffId;
  readonly campaignId?: CampaignId;
  readonly provider: string;
  readonly model: string;
  readonly endpoint: string;
  readonly mediaKind: VirtualTryOnMediaKind;
  readonly quality: VirtualTryOnQualityLevel;
  readonly trigger: VirtualTryOnTrigger;
  readonly inputAssetIds: readonly string[];
  readonly outputAssetId?: string;
  readonly creditsReserved?: number;
  readonly creditsConsumed?: number;
  readonly estimatedCost: Money;
  readonly actualCost?: Money;
  readonly internalCost?: Money;
  readonly conversionEvent?: string;
  readonly attributedRevenue?: Money;
  readonly cacheHit: boolean;
  readonly status: VirtualTryOnLedgerStatus;
  readonly denialReason?: VirtualTryOnDenialReason;
  readonly failureCode?: string;
  readonly createdAt: string;
  readonly settledAt?: string;
}
