import { describe, expect, it } from "vitest";

import {
  buildMorningRoutineEmailHtml,
  filterCatalogueByEligibleProducts,
  getLocalDateString,
  getLocalHour,
  isWithinQuietPeriod,
  matchesDeliveryFrequency,
  shouldDeliverMorningRoutine,
  type MorningRoutineRetailerDeliverySettings,
  type MorningRoutineSubscription,
} from "./morning-routine-delivery";

const baseSubscription: MorningRoutineSubscription = {
  retailerId: "retailer-1",
  customerId: "customer-1",
  deliveryOptIn: true,
  frequency: "daily",
  channels: ["in_app", "email"],
  timezone: "UTC",
  deliveryHourLocal: 7,
  quietStartHour: null,
  quietEndHour: null,
  weeklyAnchorDow: 1,
};

const baseRetailerSettings: MorningRoutineRetailerDeliverySettings = {
  retailerId: "retailer-1",
  enabled: true,
  deliveryHourLocal: 7,
  eligibleProductIds: [],
};

describe("isWithinQuietPeriod", () => {
  it("returns false when quiet hours are unset", () => {
    expect(isWithinQuietPeriod(8, null, null)).toBe(false);
  });

  it("detects same-day quiet windows", () => {
    expect(isWithinQuietPeriod(8, 22, 23)).toBe(false);
    expect(isWithinQuietPeriod(22, 22, 23)).toBe(true);
  });

  it("detects overnight quiet windows", () => {
    expect(isWithinQuietPeriod(23, 22, 7)).toBe(true);
    expect(isWithinQuietPeriod(6, 22, 7)).toBe(true);
    expect(isWithinQuietPeriod(12, 22, 7)).toBe(false);
  });
});

describe("matchesDeliveryFrequency", () => {
  it("allows daily delivery every day", () => {
    expect(
      matchesDeliveryFrequency({
        frequency: "daily",
        weeklyAnchorDow: 1,
        localDow: 3,
        forDate: "2026-07-29",
      }),
    ).toBe(true);
  });

  it("restricts weekly delivery to anchor day without prior send", () => {
    expect(
      matchesDeliveryFrequency({
        frequency: "weekly",
        weeklyAnchorDow: 1,
        localDow: 1,
        forDate: "2026-07-27",
      }),
    ).toBe(true);
    expect(
      matchesDeliveryFrequency({
        frequency: "weekly",
        weeklyAnchorDow: 1,
        localDow: 2,
        forDate: "2026-07-28",
      }),
    ).toBe(false);
  });

  it("blocks duplicate weekly delivery on the same date", () => {
    expect(
      matchesDeliveryFrequency({
        frequency: "weekly",
        weeklyAnchorDow: 1,
        localDow: 1,
        forDate: "2026-07-27",
        lastWeeklyDeliveryDate: "2026-07-27",
      }),
    ).toBe(false);
  });
});

describe("shouldDeliverMorningRoutine", () => {
  const now = new Date("2026-07-29T07:00:00.000Z");

  it("requires explicit opt-in and personalization", () => {
    expect(
      shouldDeliverMorningRoutine({
        subscription: { ...baseSubscription, deliveryOptIn: false },
        retailerSettings: baseRetailerSettings,
        personalizationGranted: true,
        now,
        forDate: "2026-07-29",
        localHour: 7,
        localDow: 3,
        deliveredChannelsToday: [],
      }),
    ).toEqual({ deliver: false, reason: "not_opted_in" });

    expect(
      shouldDeliverMorningRoutine({
        subscription: baseSubscription,
        retailerSettings: baseRetailerSettings,
        personalizationGranted: false,
        now,
        forDate: "2026-07-29",
        localHour: 7,
        localDow: 3,
        deliveredChannelsToday: [],
      }),
    ).toEqual({
      deliver: false,
      reason: "missing_personalization_consent",
    });
  });

  it("respects retailer disablement and quiet period", () => {
    expect(
      shouldDeliverMorningRoutine({
        subscription: baseSubscription,
        retailerSettings: { ...baseRetailerSettings, enabled: false },
        personalizationGranted: true,
        now,
        forDate: "2026-07-29",
        localHour: 7,
        localDow: 3,
        deliveredChannelsToday: [],
      }),
    ).toEqual({ deliver: false, reason: "retailer_disabled" });

    expect(
      shouldDeliverMorningRoutine({
        subscription: {
          ...baseSubscription,
          quietStartHour: 6,
          quietEndHour: 8,
        },
        retailerSettings: baseRetailerSettings,
        personalizationGranted: true,
        now,
        forDate: "2026-07-29",
        localHour: 7,
        localDow: 3,
        deliveredChannelsToday: [],
      }),
    ).toEqual({ deliver: false, reason: "quiet_period" });
  });

  it("is idempotent once all channels delivered for the day", () => {
    expect(
      shouldDeliverMorningRoutine({
        subscription: baseSubscription,
        retailerSettings: baseRetailerSettings,
        personalizationGranted: true,
        now,
        forDate: "2026-07-29",
        localHour: 7,
        localDow: 3,
        deliveredChannelsToday: ["in_app", "email"],
      }),
    ).toEqual({ deliver: false, reason: "already_delivered" });
  });
});

describe("filterCatalogueByEligibleProducts", () => {
  it("passes through all candidates when allowlist is empty", () => {
    const candidates = [{ productId: "a" }, { productId: "b" }];
    expect(filterCatalogueByEligibleProducts(candidates, [])).toEqual(
      candidates,
    );
  });

  it("filters to retailer-selected products only", () => {
    expect(
      filterCatalogueByEligibleProducts(
        [{ productId: "a" }, { productId: "b" }],
        ["b"],
      ),
    ).toEqual([{ productId: "b" }]);
  });
});

describe("timezone helpers", () => {
  it("derives UTC local hour and date", () => {
    const now = new Date("2026-07-29T07:30:00.000Z");
    expect(getLocalHour(now, "UTC")).toBe(7);
    expect(getLocalDateString(now, "UTC")).toBe("2026-07-29");
  });
});

describe("delivery payload builders", () => {
  it("includes unsubscribe link and routine recommendations in email html", () => {
    const html = buildMorningRoutineEmailHtml(
      {
        selectionId: "sel-1",
        forDate: "2026-07-29",
        summary: "Selected 1 owned recommendation.",
        recommendations: [
          {
            rank: 1,
            source: "owned",
            displayName: "Navy jacket",
            explanation: ["Owned garment available in your wardrobe."],
          },
        ],
        routineHref: "https://app.example/morning-routine",
        unsubscribeHref:
          "https://app.example/morning-routine/unsubscribe?token=abc",
      },
      "Atelier",
    );
    expect(html).toContain("Navy jacket");
    expect(html).toContain("unsubscribe?token=abc");
    expect(html).toContain("not marketing mail");
  });
});
