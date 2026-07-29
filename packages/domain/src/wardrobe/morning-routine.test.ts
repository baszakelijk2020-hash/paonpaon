import { describe, expect, it } from "vitest";

import type { CalendarOccasion } from "../integrations/calendar";
import type { WeatherSnapshot } from "../integrations/weather";
import type { ConsentSnapshot } from "../intelligence/consent";
import { asId } from "../shared/branded-id";

import {
  attachRetailerSlugToActions,
  resolveMorningRoutineInputStatuses,
  selectMorningRoutine,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineWardrobeCandidate,
} from "./morning-routine";
import {
  generateMorningRoutineInputSchema,
  morningRoutineActionInputSchema,
  persistMorningRoutineSelectionInputSchema,
} from "./morning-routine.schema";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("22222222-2222-4222-8222-222222222222");

const grantedConsent: ConsentSnapshot = {
  personalization: "granted",
  marketing: "denied",
  location: "granted",
  capturedAt: "2026-07-30T08:00:00.000Z",
  basis: "explicit_opt_in",
};

const withdrawnConsent: ConsentSnapshot = {
  personalization: "withdrawn",
  marketing: "denied",
  location: "withdrawn",
  capturedAt: "2026-07-30T08:00:00.000Z",
  basis: "explicit_opt_out",
};

const rain: WeatherSnapshot = {
  temperatureCelsius: 11,
  description: "light rain",
  locationLabel: "Blaricum",
  status: "mock",
  observedAt: "2026-07-30T08:00:00.000Z",
};

const occasions: CalendarOccasion[] = [
  {
    label: "Wedding fitting",
    startsAt: "2026-07-30T14:00:00.000Z",
    source: "appointment",
    appointmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  },
];

function owned(
  partial: Partial<MorningRoutineWardrobeCandidate> &
    Pick<MorningRoutineWardrobeCandidate, "wardrobeItemId" | "displayName">,
): MorningRoutineWardrobeCandidate {
  return {
    categoryCode: "jacket",
    condition: "excellent",
    careState: "current",
    ...partial,
  };
}

function catalogue(
  partial: Partial<MorningRoutineCatalogueCandidate> &
    Pick<
      MorningRoutineCatalogueCandidate,
      "productId" | "displayName" | "productSlug"
    >,
): MorningRoutineCatalogueCandidate {
  return {
    available: true,
    ...partial,
  };
}

describe("selectMorningRoutine", () => {
  it("ranks owned available garments before catalogue items", () => {
    const result = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: grantedConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "Navy jacket",
          categoryCode: "jacket",
        }),
      ],
      catalogue: [
        catalogue({
          productId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
          displayName: "Catalogue coat",
          productSlug: "catalogue-coat",
          categoryCode: "overcoat",
          productVariantId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        }),
      ],
      weather: rain,
      weatherStatus: "used",
      occasions,
      calendarStatus: "used",
      location: { kind: "store_city", label: "Blaricum" },
      locationStatus: "used",
      personalizationStatus: "skipped_absent",
    });

    expect(result.recommendations[0]?.source).toBe("owned");
    expect(result.recommendations[0]?.displayName).toBe("Navy jacket");
    expect(result.recommendations.some((r) => r.source === "catalogue")).toBe(
      true,
    );
    expect(result.recommendations[0]?.explanation[0]).toMatch(/Owned garment/);
  });

  it("excludes unavailable owned garments", () => {
    const result = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: grantedConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "Retired coat",
          categoryCode: "overcoat",
          condition: "retired",
          retiredAt: "2026-01-01T00:00:00.000Z",
        }),
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
          displayName: "In service suit",
          categoryCode: "suit",
          careState: "in_service",
        }),
      ],
      catalogue: [],
      weatherStatus: "skipped_unavailable",
      occasions: [],
      calendarStatus: "skipped_absent",
      location: { kind: "none" },
      locationStatus: "skipped_absent",
      personalizationStatus: "skipped_absent",
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.summary).toMatch(/No available/);
  });

  it("boosts coats for rainy weather and explains why", () => {
    const result = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: grantedConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "All-weather overcoat",
          categoryCode: "overcoat",
        }),
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
          displayName: "Linen shirt",
          categoryCode: "shirt",
        }),
      ],
      catalogue: [],
      weather: rain,
      weatherStatus: "used",
      occasions: [],
      calendarStatus: "skipped_absent",
      location: { kind: "store_city", label: "Blaricum" },
      locationStatus: "used",
      personalizationStatus: "skipped_absent",
    });

    expect(result.recommendations[0]?.displayName).toBe("All-weather overcoat");
    expect(
      result.recommendations[0]?.factors.some((f) => f.code === "weather"),
    ).toBe(true);
    expect(result.provenance.weatherSummary).toMatch(/11°C/);
  });

  it("continues without location and weather when consent is withdrawn", () => {
    const statuses = resolveMorningRoutineInputStatuses({
      consent: withdrawnConsent,
      locationKind: "store_city",
      locationLabel: "Blaricum",
      weather: rain,
      occasions,
      styleProfilePresent: true,
    });
    expect(statuses.locationStatus).toBe("skipped_no_consent");
    expect(statuses.weatherStatus).toBe("skipped_no_consent");
    expect(statuses.personalizationStatus).toBe("skipped_no_consent");

    const result = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: withdrawnConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "Navy jacket",
        }),
      ],
      catalogue: [],
      weather: rain,
      weatherStatus: statuses.weatherStatus,
      occasions,
      calendarStatus: statuses.calendarStatus,
      location: statuses.location,
      locationStatus: statuses.locationStatus,
      personalizationStatus: statuses.personalizationStatus,
      styleProfile: {
        declaredConceptIds: ["concept-1"],
        inferredPositiveConceptIds: [],
        inferredNegativeConceptIds: [],
      },
    });

    expect(result.provenance.weatherStatus).toBe("skipped_no_consent");
    expect(result.summary).toMatch(/location consent/);
    expect(
      result.recommendations[0]?.factors.some(
        (f) => f.code === "consent_fallback",
      ),
    ).toBe(true);
  });

  it("treats weather and calendar provider failure as skippable", () => {
    const statuses = resolveMorningRoutineInputStatuses({
      consent: grantedConsent,
      locationKind: "store_city",
      locationLabel: "Blaricum",
      weather: null,
      weatherFailed: true,
      occasions: [],
      calendarFailed: true,
      styleProfilePresent: false,
    });
    expect(statuses.weatherStatus).toBe("skipped_failed");
    expect(statuses.calendarStatus).toBe("skipped_failed");
  });

  it("exposes save/review/book/buy where valid after slug attachment", () => {
    const base = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: grantedConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "Navy jacket",
        }),
      ],
      catalogue: [
        catalogue({
          productId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
          productVariantId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
          displayName: "Catalogue coat",
          productSlug: "catalogue-coat",
          categoryCode: "overcoat",
        }),
      ],
      weatherStatus: "skipped_unavailable",
      occasions: [],
      calendarStatus: "skipped_absent",
      location: { kind: "none" },
      locationStatus: "skipped_no_consent",
      personalizationStatus: "skipped_absent",
    });

    const withLinks = attachRetailerSlugToActions(base, "acme");
    const ownedRec = withLinks.recommendations.find(
      (r) => r.source === "owned",
    );
    const catalogueRec = withLinks.recommendations.find(
      (r) => r.source === "catalogue",
    );

    expect(ownedRec?.actions.find((a) => a.kind === "buy")?.available).toBe(
      false,
    );
    expect(ownedRec?.actions.find((a) => a.kind === "book")?.href).toBe(
      "/r/acme/appointments",
    );
    expect(ownedRec?.actions.find((a) => a.kind === "review")?.available).toBe(
      true,
    );
    expect(
      catalogueRec?.actions.find((a) => a.kind === "save")?.available,
    ).toBe(true);
    expect(catalogueRec?.actions.find((a) => a.kind === "buy")?.href).toMatch(
      /\/r\/acme\/products\/catalogue-coat/,
    );
  });

  it("applies style profile boosts only when personalization is used", () => {
    const conceptId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
    const result = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: grantedConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "Preferred jacket",
          conceptIds: [conceptId],
        }),
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
          displayName: "Other jacket",
          conceptIds: [],
        }),
      ],
      catalogue: [],
      styleProfile: {
        declaredConceptIds: [conceptId],
        inferredPositiveConceptIds: [],
        inferredNegativeConceptIds: [],
      },
      weatherStatus: "skipped_unavailable",
      occasions: [],
      calendarStatus: "skipped_absent",
      location: { kind: "none" },
      locationStatus: "skipped_absent",
      personalizationStatus: "used",
    });

    expect(result.recommendations[0]?.displayName).toBe("Preferred jacket");
    expect(
      result.recommendations[0]?.factors.some(
        (f) => f.code === "style_declared",
      ),
    ).toBe(true);
  });
});

describe("morning-routine schemas", () => {
  it("accepts generate and action payloads", () => {
    expect(
      generateMorningRoutineInputSchema.parse({
        retailerId,
        customerId,
        forDate: "2026-07-30",
      }).forDate,
    ).toBe("2026-07-30");

    expect(
      morningRoutineActionInputSchema.parse({
        selectionId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        action: "save",
        retailerId,
        productVariantId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      }).action,
    ).toBe("save");
  });

  it("rejects invalid forDate", () => {
    expect(
      generateMorningRoutineInputSchema.safeParse({
        retailerId,
        customerId,
        forDate: "30-07-2026",
      }).success,
    ).toBe(false);
  });

  it("accepts a persistable selection payload", () => {
    const selection = selectMorningRoutine({
      retailerId,
      customerId,
      forDate: "2026-07-30",
      consent: grantedConsent,
      wardrobe: [
        owned({
          wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
          displayName: "Navy jacket",
        }),
      ],
      catalogue: [],
      weatherStatus: "skipped_unavailable",
      occasions: [],
      calendarStatus: "skipped_absent",
      location: { kind: "none" },
      locationStatus: "skipped_absent",
      personalizationStatus: "skipped_absent",
    });

    const parsed = persistMorningRoutineSelectionInputSchema.safeParse({
      retailerId: selection.retailerId,
      customerId: selection.customerId,
      forDate: selection.forDate,
      summary: selection.summary,
      provenance: selection.provenance,
      recommendations: selection.recommendations,
    });
    expect(parsed.success).toBe(true);
  });
});
