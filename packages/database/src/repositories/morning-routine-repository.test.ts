import {
  attachRetailerSlugToActions,
  persistMorningRoutineSelectionInputSchema,
  selectMorningRoutine,
  type ConsentSnapshot,
} from "@paon/domain";
import { describe, expect, it } from "vitest";

describe("MorningRoutineRepository persist payload contract", () => {
  it("maps a selected routine into the RPC persist schema", () => {
    const consent: ConsentSnapshot = {
      personalization: "granted",
      marketing: "denied",
      location: "granted",
      capturedAt: "2026-07-30T08:00:00.000Z",
      basis: "explicit_opt_in",
    };

    const selection = attachRetailerSlugToActions(
      selectMorningRoutine({
        retailerId: "11111111-1111-4111-8111-111111111111",
        customerId: "22222222-2222-4222-8222-222222222222",
        forDate: "2026-07-30",
        consent,
        wardrobe: [
          {
            wardrobeItemId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
            displayName: "Navy jacket",
            categoryCode: "jacket",
            condition: "excellent",
            careState: "current",
          },
        ],
        catalogue: [
          {
            productId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
            productVariantId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
            displayName: "Rain coat",
            productSlug: "rain-coat",
            categoryCode: "overcoat",
            available: true,
          },
        ],
        weatherStatus: "skipped_unavailable",
        occasions: [],
        calendarStatus: "skipped_absent",
        location: { kind: "store_city", label: "Blaricum" },
        locationStatus: "used",
        personalizationStatus: "skipped_absent",
      }),
      "acme",
    );

    const parsed = persistMorningRoutineSelectionInputSchema.safeParse({
      retailerId: selection.retailerId,
      customerId: selection.customerId,
      forDate: selection.forDate,
      summary: selection.summary,
      provenance: selection.provenance,
      recommendations: selection.recommendations,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(
      parsed.data.recommendations[0]?.actions.some((a) => a.kind === "book"),
    ).toBe(true);
  });
});
