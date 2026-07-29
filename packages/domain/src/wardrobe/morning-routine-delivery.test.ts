import { describe, expect, it } from "vitest";

import {
  buildMorningRoutineDeliveryNotification,
  evaluateMorningRoutineDelivery,
  filterCatalogueByEligibleProducts,
  isInQuietHours,
  localDateInTimezone,
  matchesDeliveryFrequency,
} from "./morning-routine-delivery";
import { upsertMorningRoutineSubscriptionInputSchema } from "./morning-routine-delivery.schema";

const baseSubscription = {
  optedIn: true,
  frequency: "daily" as const,
  timezone: "Europe/Amsterdam",
  channels: ["in_app", "email"] as const,
  preferredLocalHour: 7,
};

describe("MorningRoutine delivery gates", () => {
  it("skips when not opted in", () => {
    const result = evaluateMorningRoutineDelivery({
      subscription: { ...baseSubscription, optedIn: false },
      nowUtcIso: "2026-07-30T08:00:00.000Z",
      alreadyDeliveredForDate: false,
      selectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.outcome).toBe("skipped_not_opted_in");
  });

  it("skips quiet hours and duplicates", () => {
    const quiet = evaluateMorningRoutineDelivery({
      subscription: {
        ...baseSubscription,
        quietHours: { startMinute: 0, endMinute: 23 * 60 + 59 },
        preferredLocalHour: 0,
      },
      nowUtcIso: "2026-07-30T10:00:00.000Z",
      alreadyDeliveredForDate: false,
      selectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    });
    expect(quiet.ok).toBe(false);
    if (!quiet.ok) expect(quiet.outcome).toBe("skipped_quiet_hours");

    const duplicate = evaluateMorningRoutineDelivery({
      subscription: baseSubscription,
      nowUtcIso: "2026-07-30T10:00:00.000Z",
      alreadyDeliveredForDate: true,
      selectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.outcome).toBe("skipped_duplicate");
  });

  it("allows delivery after preferred hour when opted in", () => {
    const result = evaluateMorningRoutineDelivery({
      subscription: baseSubscription,
      nowUtcIso: "2026-07-30T08:00:00.000Z", // 10:00 Amsterdam (CEST)
      alreadyDeliveredForDate: false,
      selectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.forDate).toBe(
      localDateInTimezone("2026-07-30T08:00:00.000Z", "Europe/Amsterdam"),
    );
    expect(result.channels).toEqual(["in_app", "email"]);
  });

  it("respects weekdays frequency", () => {
    expect(
      matchesDeliveryFrequency({
        frequency: "weekdays",
        forDate: "2026-07-30",
        weekday: 4,
      }),
    ).toBe(true);
    expect(
      matchesDeliveryFrequency({
        frequency: "weekdays",
        forDate: "2026-08-01",
        weekday: 6,
      }),
    ).toBe(false);
  });

  it("wraps quiet hours across midnight", () => {
    expect(
      isInQuietHours(23 * 60, { startMinute: 22 * 60, endMinute: 6 * 60 }),
    ).toBe(true);
    expect(
      isInQuietHours(7 * 60, { startMinute: 22 * 60, endMinute: 6 * 60 }),
    ).toBe(false);
  });
});

describe("eligible product filter", () => {
  it("keeps owned picks and only eligible catalogue picks", () => {
    const { kept, suppressedCatalogueCount } =
      filterCatalogueByEligibleProducts(
        [
          { source: "owned" as const },
          {
            source: "catalogue" as const,
            productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          },
          {
            source: "catalogue" as const,
            productId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
          },
        ],
        new Set(["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"]),
      );
    expect(kept).toHaveLength(2);
    expect(suppressedCatalogueCount).toBe(1);
  });

  it("blocks unrelated catalogue injection when eligibility is empty", () => {
    const { kept, suppressedCatalogueCount } =
      filterCatalogueByEligibleProducts(
        [
          {
            source: "catalogue" as const,
            productId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          },
        ],
        new Set(),
      );
    expect(kept).toHaveLength(0);
    expect(suppressedCatalogueCount).toBe(1);
  });
});

describe("delivery notification copy", () => {
  it("points to the in-app MorningRoutine path", () => {
    const note = buildMorningRoutineDeliveryNotification({
      summary: "Selected 1 owned recommendation.",
      forDate: "2026-07-30",
      recommendationCount: 1,
    });
    expect(note.actionHref).toBe("/morning-routine");
    expect(note.title).toMatch(/2026-07-30/);
  });
});

describe("subscription schema", () => {
  it("requires explicit opt-in payload and valid timezone", () => {
    expect(
      upsertMorningRoutineSubscriptionInputSchema.safeParse({
        retailerId: "11111111-1111-4111-8111-111111111111",
        customerId: "22222222-2222-4222-8222-222222222222",
        optedIn: true,
        timezone: "Europe/Amsterdam",
      }).success,
    ).toBe(true);
    expect(
      upsertMorningRoutineSubscriptionInputSchema.safeParse({
        retailerId: "11111111-1111-4111-8111-111111111111",
        customerId: "22222222-2222-4222-8222-222222222222",
        optedIn: true,
        timezone: "Not/AZone",
      }).success,
    ).toBe(false);
  });
});
