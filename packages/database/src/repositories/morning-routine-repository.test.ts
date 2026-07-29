import {
  appendCatalogueProvenance,
  appendWardrobeProvenance,
  asId,
  fixtureCalendarProvider,
  fixtureWeatherProvider,
  type CustomerConsentState,
  type MorningRoutineSelectionResult,
  type Product,
  type ProductVariant,
  type WardrobeItem,
} from "@paon/domain";
import { describe, expect, it, vi } from "vitest";

import {
  appointmentCalendarProvider,
  MorningRoutineRepository,
} from "./morning-routine-repository";

const retailerId = asId<"RetailerId">("11111111-1111-4111-8111-111111111111");
const customerId = asId<"CustomerId">("33333333-3333-4333-8333-333333333333");
const wardrobeItemId = asId<"WardrobeItemId">(
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
);
const productId = asId<"ProductId">("55555555-5555-4555-8555-555555555555");
const variantId = asId<"ProductVariantId">(
  "66666666-6666-4666-8666-666666666666",
);

function consent(): CustomerConsentState {
  return {
    retailerId,
    customerId,
    personalization: { purpose: "personalization", status: "granted" },
    marketing: { purpose: "marketing", status: "denied" },
    location: { purpose: "location", status: "denied" },
    updatedAt: "2026-07-30T10:00:00.000Z",
  };
}

const wardrobeItem: WardrobeItem = {
  id: wardrobeItemId,
  retailerId,
  customerId,
  ownershipKind: "retailer_purchased",
  provenanceSource: "catalogue_link",
  categoryCode: "jacket",
  displayName: "Navy jacket",
  condition: "excellent",
  careState: "current",
  fitPerception: "true_to_size",
  createdByActor: "customer",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const product: Product = {
  id: productId,
  retailerId,
  name: "White Oxford shirt",
  slug: "white-oxford-shirt",
  description: "A crisp shirt for tailored looks",
  status: "active",
  isMadeToOrder: false,
  isAlterable: true,
  collectionIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const variant: ProductVariant = {
  id: variantId,
  productId,
  sku: "SHIRT-001",
  price: { amountMinorUnits: 18000, currency: "EUR" },
  inventoryQuantity: 3,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("MorningRoutineRepository", () => {
  it("projects owned-first recommendations with provider fixtures", async () => {
    const repo = new MorningRoutineRepository({} as never, {
      retailers: {
        findById: vi.fn().mockResolvedValue({
          id: retailerId,
          status: "active",
          slug: "atelier-demo",
          displayName: "Atelier Demo",
          billingAddress: { city: "Amsterdam" },
        }),
      } as never,
      wardrobe: {
        findByCustomer: vi.fn().mockResolvedValue([wardrobeItem]),
      } as never,
      products: {
        findByRetailer: vi.fn().mockResolvedValue([product]),
      } as never,
      variants: {
        findByProduct: vi.fn().mockResolvedValue([variant]),
      } as never,
      metadata: {
        findAssignmentsForTarget: vi.fn().mockResolvedValue([]),
      } as never,
      consent: {
        getState: vi.fn().mockResolvedValue(consent()),
      } as never,
      styleProfile: {
        findByCustomer: vi.fn().mockResolvedValue(null),
      } as never,
      appointments: {
        findByCustomer: vi.fn().mockResolvedValue([]),
      } as never,
      weather: fixtureWeatherProvider({
        temperatureCelsius: 19,
        description: "light rain",
        city: "Amsterdam",
      }),
      calendar: fixtureCalendarProvider({
        label: "Fitting",
        startsAt: "2026-07-30T15:00:00.000Z",
        source: "fixture",
      }),
    });

    const result = (await repo.buildRoutine({
      retailerId,
      customerId,
      slug: "atelier-demo",
    })) as MorningRoutineSelectionResult;

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(
      result.recommendations[0]?.items.some(
        (item) => item.candidate.kind === "owned_wardrobe",
      ),
    ).toBe(true);
    expect(result.provenance.some((entry) => entry.input === "weather")).toBe(
      true,
    );
  });

  it("uses appointment calendar provider when declared occasion is absent", async () => {
    const calendar = appointmentCalendarProvider({
      findByCustomer: vi.fn().mockResolvedValue([
        {
          retailerId,
          customerId,
          type: "fitting",
          status: "confirmed",
          startsAt: "2026-07-31T10:00:00.000Z",
          endsAt: "2026-07-31T11:00:00.000Z",
        },
      ]),
    } as never);

    const occasion = await calendar.fetch({ retailerId, customerId });
    expect(occasion.occasion?.source).toBe("appointment");
    expect(occasion.occasion?.label).toBe("Fitting");
  });
});

describe("morning routine provenance helpers", () => {
  it("records wardrobe and catalogue counts", () => {
    expect(appendWardrobeProvenance(2).detail).toContain("2 owned garments");
    expect(appendCatalogueProvenance(0).used).toBe(false);
  });
});
