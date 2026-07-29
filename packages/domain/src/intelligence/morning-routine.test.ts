import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";
import { garmentCategoryToOutfitSlot } from "../wardrobe/sartorial";
import type { WardrobeItem } from "../wardrobe/wardrobe";

import type { CustomerConsentState } from "./consent";
import {
  appendCatalogueProvenance,
  appendStyleProfileProvenance,
  appendWardrobeProvenance,
  failingCalendarProvider,
  failingWeatherProvider,
  fixtureCalendarProvider,
  fixtureWeatherProvider,
  isWardrobeItemAvailableForRoutine,
  projectWardrobeCandidate,
  selectMorningRoutineRecommendations,
  type MorningRoutineCatalogueCandidate,
  type MorningRoutineSelectionRequest,
  type MorningRoutineWardrobeCandidate,
} from "./morning-routine";
import type { CustomerStyleProfile } from "./style-profile";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const conceptId = asId<"MetadataConceptId">(
  "44444444-4444-4444-8444-444444444444",
);
const wardrobeJacket = asId<"WardrobeItemId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);
const wardrobeTrousers = asId<"WardrobeItemId">(
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
);
const productShirt = asId<"ProductId">("55555555-5555-4555-8555-555555555555");
const variantShirt = asId<"ProductVariantId">(
  "66666666-6666-4666-8666-666666666666",
);
const productShoes = asId<"ProductId">("77777777-7777-4777-8777-777777777777");
const variantShoes = asId<"ProductVariantId">(
  "88888888-8888-4888-8888-888888888888",
);

function consent(
  status: CustomerConsentState["personalization"]["status"],
  locationStatus: CustomerConsentState["location"]["status"] = "denied",
): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: { purpose: "personalization", status },
    marketing: { purpose: "marketing", status: "denied" },
    location: { purpose: "location", status: locationStatus },
    updatedAt: "2026-07-30T10:00:00.000Z",
  };
}

function wardrobeCandidate(
  overrides: Partial<MorningRoutineWardrobeCandidate> &
    Pick<
      MorningRoutineWardrobeCandidate,
      "wardrobeItemId" | "label" | "slotKind"
    >,
): MorningRoutineWardrobeCandidate {
  return {
    kind: "owned_wardrobe",
    categoryCode: "jacket",
    available: true,
    ...overrides,
  };
}

function catalogueCandidate(
  overrides: Partial<MorningRoutineCatalogueCandidate> &
    Pick<
      MorningRoutineCatalogueCandidate,
      "productId" | "productVariantId" | "label" | "slug" | "slotKind"
    >,
): MorningRoutineCatalogueCandidate {
  return {
    kind: "catalogue_product",
    available: true,
    ...overrides,
  };
}

function baseRequest(
  overrides?: Partial<MorningRoutineSelectionRequest>,
): MorningRoutineSelectionRequest & { slug: string } {
  return {
    retailerId,
    customerId,
    consent: consent("granted"),
    slug: "atelier-demo",
    wardrobe: [
      wardrobeCandidate({
        wardrobeItemId: wardrobeJacket,
        label: "Navy jacket",
        slotKind: "jacket",
        categoryCode: "jacket",
      }),
      wardrobeCandidate({
        wardrobeItemId: wardrobeTrousers,
        label: "Grey trousers",
        slotKind: "trousers",
        categoryCode: "trousers",
      }),
    ],
    catalogue: [
      catalogueCandidate({
        productId: productShirt,
        productVariantId: variantShirt,
        label: "White shirt",
        slug: "white-shirt",
        slotKind: "shirt",
      }),
      catalogueCandidate({
        productId: productShoes,
        productVariantId: variantShoes,
        label: "Oxford shoes",
        slug: "oxford-shoes",
        slotKind: "shoes",
      }),
    ],
    provenance: [appendWardrobeProvenance(2), appendCatalogueProvenance(2)],
    ...overrides,
  };
}

describe("morning routine availability", () => {
  it("marks retired and in-service wardrobe items unavailable", () => {
    expect(
      isWardrobeItemAvailableForRoutine({
        condition: "good",
        careState: "current",
      }),
    ).toBe(true);
    expect(
      isWardrobeItemAvailableForRoutine({
        condition: "retired",
        careState: "current",
        retiredAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isWardrobeItemAvailableForRoutine({
        condition: "good",
        careState: "in_service",
      }),
    ).toBe(false);
  });

  it("projects wardrobe candidates with slot mapping", () => {
    const item = {
      id: wardrobeJacket,
      retailerId,
      customerId,
      ownershipKind: "retailer_purchased",
      provenanceSource: "order_line",
      categoryCode: "jacket",
      displayName: "Navy jacket",
      condition: "excellent",
      careState: "current",
      fitPerception: "true_to_size",
      createdByActor: "customer",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies WardrobeItem;

    expect(garmentCategoryToOutfitSlot("jacket")).toBe("jacket");
    expect(projectWardrobeCandidate(item)?.slotKind).toBe("jacket");
  });
});

describe("morning routine selection", () => {
  it("ranks owned garments ahead of catalogue gap fills", () => {
    const result = selectMorningRoutineRecommendations(baseRequest());
    expect(result.recommendations.length).toBeGreaterThan(0);
    const primary = result.recommendations[0];
    expect(primary?.title).toBe("Wear what you own");
    const owned = primary?.items.filter(
      (item) => item.candidate.kind === "owned_wardrobe",
    );
    expect(owned?.length).toBeGreaterThanOrEqual(2);
    expect(
      primary?.items.some(
        (item) => item.candidate.kind === "catalogue_product",
      ),
    ).toBe(true);
  });

  it("continues without location and records provenance", () => {
    const result = selectMorningRoutineRecommendations(
      baseRequest({
        weather: null,
        provenance: [
          appendWardrobeProvenance(2),
          appendCatalogueProvenance(2),
          {
            input: "location",
            used: false,
            detail: "Location consent not granted — using retailer default",
          },
        ],
      }),
    );
    expect(result.locationUsed).toBe(false);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("excludes StyleProfile when personalization consent is withdrawn", () => {
    const styleProfile: CustomerStyleProfile = {
      id: asId("99999999-9999-4999-8999-999999999999"),
      retailerId,
      customerId,
      explicitPreferences: [
        {
          conceptId,
          polarity: "positive",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      inferredPreferences: [],
      confidence: {
        overall: 0.8,
        inferredCount: 0,
        explicitCount: 1,
        activeEvidenceCount: 1,
      },
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
    const provenance = appendStyleProfileProvenance({
      consent: consent("withdrawn"),
      styleProfile,
    });
    expect(provenance.used).toBe(false);
    expect(provenance.input).toBe("withdrawn");

    const result = selectMorningRoutineRecommendations(
      baseRequest({
        consent: consent("withdrawn"),
        styleProfile,
        provenance: [appendWardrobeProvenance(2), provenance],
      }),
    );
    expect(result.personalizationUsed).toBe(false);
    expect(
      result.recommendations[0]?.factors.some(
        (factor) => factor.code === "withdrawn_consent_excluded",
      ),
    ).toBe(true);
  });

  it("exposes save/review/book/buy actions where valid", () => {
    const result = selectMorningRoutineRecommendations(baseRequest());
    const catalogueItem = result.recommendations[0]?.items.find(
      (item) => item.candidate.kind === "catalogue_product",
    );
    expect(catalogueItem?.actions.map((action) => action.kind).sort()).toEqual([
      "book",
      "buy",
      "review",
      "save",
    ]);

    const ownedItem = result.recommendations[0]?.items.find(
      (item) => item.candidate.kind === "owned_wardrobe",
    );
    expect(ownedItem?.actions.some((action) => action.kind === "review")).toBe(
      true,
    );
    expect(ownedItem?.actions.some((action) => action.kind === "book")).toBe(
      true,
    );
  });

  it("penalizes unavailable garments", () => {
    const result = selectMorningRoutineRecommendations(
      baseRequest({
        wardrobe: [
          wardrobeCandidate({
            wardrobeItemId: wardrobeJacket,
            label: "Unavailable jacket",
            slotKind: "jacket",
            available: false,
          }),
        ],
        catalogue: [
          catalogueCandidate({
            productId: productShirt,
            productVariantId: variantShirt,
            label: "White shirt",
            slug: "white-shirt",
            slotKind: "jacket",
            available: true,
          }),
        ],
      }),
    );
    const chosen = result.recommendations[0]?.items[0]?.candidate;
    expect(chosen?.kind).toBe("catalogue_product");
  });
});

describe("morning routine provider fixtures", () => {
  it("returns fixture weather and calendar without a live provider", async () => {
    const weather = await fixtureWeatherProvider({
      temperatureCelsius: 18,
      description: "clear sky",
      city: "Amsterdam",
    }).fetch({
      retailerId,
      locationGranted: false,
    });
    expect(weather.weather?.temperatureCelsius).toBe(18);

    const calendar = await fixtureCalendarProvider({
      label: "Summer wedding fitting",
      startsAt: "2026-07-30T14:00:00.000Z",
      source: "fixture",
    }).fetch({ retailerId, customerId });
    expect(calendar.occasion?.label).toBe("Summer wedding fitting");
  });

  it("fails closed on provider errors without throwing", async () => {
    const weather = await failingWeatherProvider("API timeout").fetch({
      retailerId,
      locationGranted: true,
      preciseCity: "Paris",
    });
    expect(weather.weather).toBeNull();
    expect(weather.provenance.used).toBe(false);

    const calendar = await failingCalendarProvider(
      "Calendar unavailable",
    ).fetch({ retailerId, customerId });
    expect(calendar.occasion).toBeNull();
  });
});
