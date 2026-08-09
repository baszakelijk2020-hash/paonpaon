import { describe, expect, it } from "vitest";

import {
  evaluateVirtualTryOnAuthorization,
  type EvaluateVirtualTryOnAuthorizationInput,
  type VirtualTryOnCampaignBudget,
  type VirtualTryOnDenialReason,
} from "./virtual-try-on-usage";

const currency = "USD" as const;

const basePolicy = {
  enabled: true,
  currency,
  monthlyBudgetMinorUnits: 1000,
  perCustomerMonthlyBudgetMinorUnits: 500,
  maxCustomerGenerationsPerDay: 1,
  maxCustomerGenerationsPerWeek: 2,
  maxCustomerGenerationsPerMonth: 3,
  allowImage: true,
  allowVideo: true,
} satisfies EvaluateVirtualTryOnAuthorizationInput["policy"];

const baseCustomer = {
  eligible: true,
  enabled: true,
  imageProcessingConsent: "granted",
  portraitStorageConsent: "granted",
} satisfies EvaluateVirtualTryOnAuthorizationInput["customer"];

const baseUsage = {
  customerGenerationsToday: 0,
  customerGenerationsThisWeek: 0,
  customerGenerationsThisMonth: 0,
  customerSpendThisMonthMinorUnits: 0,
  retailerSpendThisMonthMinorUnits: 0,
} satisfies EvaluateVirtualTryOnAuthorizationInput["usage"];

const baseProviderEstimate = {
  amountMinorUnits: 100,
  currency,
} satisfies EvaluateVirtualTryOnAuthorizationInput["providerEstimate"];

type TestOverrides = {
  moduleState?: EvaluateVirtualTryOnAuthorizationInput["moduleState"];
  mediaKind?: EvaluateVirtualTryOnAuthorizationInput["mediaKind"];
  persistPortrait?: boolean;
  policy?: Partial<EvaluateVirtualTryOnAuthorizationInput["policy"]>;
  customer?: Partial<EvaluateVirtualTryOnAuthorizationInput["customer"]>;
  usage?: Partial<EvaluateVirtualTryOnAuthorizationInput["usage"]>;
  providerEstimate?: Partial<
    EvaluateVirtualTryOnAuthorizationInput["providerEstimate"]
  >;
  cacheHit?: boolean;
  commerciallyJustified?: boolean;
  campaign?: EvaluateVirtualTryOnAuthorizationInput["campaign"];
  campaignRequired?: boolean;
};

function makeInput(
  overrides: TestOverrides = {},
): EvaluateVirtualTryOnAuthorizationInput {
  return {
    moduleState: overrides.moduleState ?? "active",
    mediaKind: overrides.mediaKind ?? "image",
    persistPortrait: overrides.persistPortrait ?? false,
    policy: { ...basePolicy, ...overrides.policy },
    customer: { ...baseCustomer, ...overrides.customer },
    usage: { ...baseUsage, ...overrides.usage },
    providerEstimate: {
      ...baseProviderEstimate,
      ...overrides.providerEstimate,
    },
    cacheHit: overrides.cacheHit ?? false,
    commerciallyJustified: overrides.commerciallyJustified ?? true,
    ...(overrides.campaign === undefined
      ? {}
      : { campaign: overrides.campaign }),
    ...(overrides.campaignRequired === undefined
      ? {}
      : { campaignRequired: overrides.campaignRequired }),
  };
}

function expectDenied(
  input: EvaluateVirtualTryOnAuthorizationInput,
  reason: VirtualTryOnDenialReason,
): void {
  expect(evaluateVirtualTryOnAuthorization(input)).toEqual({
    allowed: false,
    reason,
    reserve: { amountMinorUnits: 0, currency },
  });
}

function expectGenerate(
  input: EvaluateVirtualTryOnAuthorizationInput,
  reserve: EvaluateVirtualTryOnAuthorizationInput["providerEstimate"],
): void {
  expect(evaluateVirtualTryOnAuthorization(input)).toEqual({
    allowed: true,
    disposition: "generate",
    reserve,
  });
}

describe("evaluateVirtualTryOnAuthorization", () => {
  it("allows an active generation when every gate is satisfied", () => {
    expectGenerate(
      makeInput({
        persistPortrait: true,
        campaignRequired: false,
      }),
      baseProviderEstimate,
    );
  });

  it("allows an exact budget boundary without crossing any limit", () => {
    const campaign: VirtualTryOnCampaignBudget = {
      campaignId: "campaign-1",
      currency,
      monthlyBudgetMinorUnits: 100,
      spentThisMonthMinorUnits: 0,
    };

    expectGenerate(
      makeInput({
        persistPortrait: true,
        usage: {
          customerSpendThisMonthMinorUnits: 0,
          retailerSpendThisMonthMinorUnits: 0,
        },
        providerEstimate: { amountMinorUnits: 100, currency },
        policy: {
          monthlyBudgetMinorUnits: 100,
          perCustomerMonthlyBudgetMinorUnits: 100,
        },
        campaign,
        campaignRequired: true,
      }),
      { amountMinorUnits: 100, currency },
    );
  });

  it("returns a cache hit with zero reserve even when all generation quotas are exhausted", () => {
    expect(
      evaluateVirtualTryOnAuthorization(
        makeInput({
          persistPortrait: true,
          cacheHit: true,
          usage: {
            customerGenerationsToday: 1,
            customerGenerationsThisWeek: 2,
            customerGenerationsThisMonth: 3,
          },
        }),
      ),
    ).toEqual({
      allowed: true,
      disposition: "cache_hit",
      reserve: { amountMinorUnits: 0, currency },
    });
  });

  it.each([["off" as const], ["preview" as const], ["suspended" as const]])(
    "rejects non-active module state %s",
    (moduleState) => {
      expectDenied(makeInput({ moduleState }), "module_not_active");
    },
  );

  it("rejects a retailer-disabled policy", () => {
    expectDenied(
      makeInput({
        policy: { enabled: false },
      }),
      "retailer_disabled",
    );
  });

  it.each([
    ["image" as const, { allowImage: false }],
    ["video" as const, { allowVideo: false }],
  ])("rejects disallowed %s generation", (mediaKind, policy) => {
    expectDenied(
      makeInput({
        mediaKind,
        policy,
      }),
      "media_not_allowed",
    );
  });

  it.each([
    [{ eligible: false }, "customer_not_eligible" as const],
    [{ enabled: false }, "customer_disabled" as const],
  ])("rejects ineligible or disabled customers", (customer, reason) => {
    expectDenied(makeInput({ customer }), reason);
  });

  it("rejects missing image-processing consent", () => {
    expectDenied(
      makeInput({
        customer: { imageProcessingConsent: "withdrawn" },
      }),
      "image_processing_consent_missing",
    );
  });

  it("rejects missing portrait storage consent when persistPortrait is requested", () => {
    expectDenied(
      makeInput({
        persistPortrait: true,
        customer: { portraitStorageConsent: "denied" },
      }),
      "portrait_storage_consent_missing",
    );
  });

  it("rejects invalid policy numbers", () => {
    expectDenied(
      makeInput({
        policy: { monthlyBudgetMinorUnits: -1 },
      }),
      "invalid_policy",
    );
  });

  it("rejects a campaign currency mismatch as an invalid policy", () => {
    expectDenied(
      makeInput({
        campaign: {
          campaignId: "campaign-2",
          currency: "EUR",
          monthlyBudgetMinorUnits: 100,
          spentThisMonthMinorUnits: 0,
        },
      }),
      "invalid_policy",
    );
  });

  it.each([
    [{ amountMinorUnits: -1, currency }, "invalid_provider_estimate" as const],
    [
      { amountMinorUnits: 100, currency: "EUR" as const },
      "invalid_provider_estimate" as const,
    ],
  ] as const)(
    "rejects invalid provider estimates",
    (providerEstimate, reason) => {
      expectDenied(makeInput({ providerEstimate }), reason);
    },
  );

  it.each([
    [
      "daily",
      { customerGenerationsToday: 1 },
      "daily_quota_exhausted" as const,
    ],
    [
      "weekly",
      { customerGenerationsThisWeek: 2 },
      "weekly_quota_exhausted" as const,
    ],
    [
      "monthly",
      { customerGenerationsThisMonth: 3 },
      "monthly_quota_exhausted" as const,
    ],
  ])("rejects exhausted %s quota", (_, usage, reason) => {
    expectDenied(makeInput({ usage }), reason);
  });

  it("rejects a customer budget overrun", () => {
    expectDenied(
      makeInput({
        usage: { customerSpendThisMonthMinorUnits: 401 },
      }),
      "customer_budget_exhausted",
    );
  });

  it("rejects a retailer budget overrun", () => {
    expectDenied(
      makeInput({
        policy: { monthlyBudgetMinorUnits: 100 },
        usage: { retailerSpendThisMonthMinorUnits: 1 },
      }),
      "retailer_budget_exhausted",
    );
  });

  it("rejects a missing required campaign", () => {
    expectDenied(
      makeInput({
        campaignRequired: true,
      }),
      "campaign_budget_unavailable",
    );
  });

  it("rejects an exhausted campaign budget", () => {
    expectDenied(
      makeInput({
        campaignRequired: true,
        campaign: {
          campaignId: "campaign-3",
          currency,
          monthlyBudgetMinorUnits: 100,
          spentThisMonthMinorUnits: 1,
        },
      }),
      "campaign_budget_exhausted",
    );
  });

  it("rejects missing commercial justification", () => {
    expectDenied(
      makeInput({
        commerciallyJustified: false,
      }),
      "commercial_justification_missing",
    );
  });
});
