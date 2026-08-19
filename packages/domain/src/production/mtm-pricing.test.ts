import { describe, expect, it } from "vitest";

import { asId } from "../shared/branded-id";

import {
  computeMtmQuoteTotal,
  MTM_PRICE_COMPONENT_CATEGORIES,
  type MtmPriceComponent,
  selectionRuleForCategory,
} from "./mtm-pricing";

const RETAILER_ID = asId<"RetailerId">("retailer-1");

function component(
  overrides: Partial<MtmPriceComponent> & {
    readonly category: MtmPriceComponent["category"];
    readonly slug: string;
    readonly priceImpactMinorUnits: number;
  },
): MtmPriceComponent {
  return {
    id: asId<"MtmPriceComponentId">(overrides.slug),
    retailerId: RETAILER_ID,
    displayName: overrides.slug,
    currency: "GBP",
    sortOrder: 0,
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const FABRIC_AA = component({
  category: "fabric_tier",
  slug: "aa",
  priceImpactMinorUnits: 40000,
});
const FABRIC_WS = component({
  category: "fabric_tier",
  slug: "ws",
  priceImpactMinorUnits: 250000,
});
const SCOPE_TWO_PIECE = component({
  category: "garment_scope",
  slug: "two_piece",
  priceImpactMinorUnits: 0,
});
const SCOPE_JACKET_ONLY = component({
  category: "garment_scope",
  slug: "jacket_only",
  priceImpactMinorUnits: -15000,
});
const MAKE_FULL_CANVAS = component({
  category: "make_method",
  slug: "full_canvas",
  priceImpactMinorUnits: 20000,
});
const MAKE_FUSED = component({
  category: "make_method",
  slug: "fused",
  priceImpactMinorUnits: 0,
});
const DESIGN_SPALLA = component({
  category: "design_option",
  slug: "spalla_camicia",
  priceImpactMinorUnits: 5000,
});
const DESIGN_DOUBLE_BREASTED = component({
  category: "design_option",
  slug: "double_breasted",
  priceImpactMinorUnits: 3000,
});
const RUSH_URGENT = component({
  category: "rush_fee",
  slug: "urgent",
  priceImpactMinorUnits: 30000,
});
const RETIRED_TIER = component({
  category: "fabric_tier",
  slug: "retired_tier",
  priceImpactMinorUnits: 10000,
  active: false,
});
const USD_TIER = component({
  category: "fabric_tier",
  slug: "usd_tier",
  priceImpactMinorUnits: 40000,
  currency: "USD",
});

const CATALOGUE: readonly MtmPriceComponent[] = [
  FABRIC_AA,
  FABRIC_WS,
  SCOPE_TWO_PIECE,
  SCOPE_JACKET_ONLY,
  MAKE_FULL_CANVAS,
  MAKE_FUSED,
  DESIGN_SPALLA,
  DESIGN_DOUBLE_BREASTED,
  RUSH_URGENT,
  RETIRED_TIER,
  USD_TIER,
];

describe("selectionRuleForCategory", () => {
  it("classifies every real category, base categories are single-select", () => {
    expect(selectionRuleForCategory("fabric_tier")).toBe("base_single");
    expect(selectionRuleForCategory("garment_scope")).toBe("base_single");
  });

  it("classifies make_method and rush_fee as single-select modifiers", () => {
    expect(selectionRuleForCategory("make_method")).toBe("modifier_single");
    expect(selectionRuleForCategory("rush_fee")).toBe("modifier_single");
  });

  it("classifies design_option as multi-select", () => {
    expect(selectionRuleForCategory("design_option")).toBe("modifier_multi");
  });

  it("covers every declared category with no gaps", () => {
    for (const category of MTM_PRICE_COMPONENT_CATEGORIES) {
      expect(() => selectionRuleForCategory(category)).not.toThrow();
    }
  });
});

describe("computeMtmQuoteTotal", () => {
  it("sums base fabric tier + garment scope with no modifiers", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: true, totalMinorUnits: 40000 });
  });

  it("a cheaper garment scope can subtract from the base (jacket-only vs two-piece)", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_JACKET_ONLY.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: true, totalMinorUnits: 25000 });
  });

  it("adds a single make-method modifier", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        makeMethodComponentId: MAKE_FULL_CANVAS.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: true, totalMinorUnits: 60000 });
  });

  it("sums multiple design options additively", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [DESIGN_SPALLA.id, DESIGN_DOUBLE_BREASTED.id],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: true, totalMinorUnits: 48000 });
  });

  it("combines every category kind in one quote (the full real-world case)", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_WS.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        makeMethodComponentId: MAKE_FULL_CANVAS.id,
        rushFeeComponentId: RUSH_URGENT.id,
        designOptionComponentIds: [DESIGN_SPALLA.id, DESIGN_DOUBLE_BREASTED.id],
      },
      CATALOGUE,
    );
    // 250000 + 0 + 20000 + 30000 + 5000 + 3000
    expect(result).toEqual({ ok: true, totalMinorUnits: 308000 });
  });

  it("a zero-cost modifier (fused make method) still resolves, not treated as absent", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        makeMethodComponentId: MAKE_FUSED.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: true, totalMinorUnits: 40000 });
  });

  it("refuses an unknown fabric tier id", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: asId<"MtmPriceComponentId">("no-such-tier"),
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: false, reason: "fabric_tier_not_found" });
  });

  it("refuses a component id that exists but is the wrong category", () => {
    const result = computeMtmQuoteTotal(
      {
        // a garment_scope id passed where a fabric_tier was required
        fabricTierComponentId: SCOPE_TWO_PIECE.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: false, reason: "fabric_tier_wrong_category" });
  });

  it("refuses a retired/inactive fabric tier — a discontinued option can never silently reprice again", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: RETIRED_TIER.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: false, reason: "fabric_tier_inactive" });
  });

  it("refuses an unknown design option among an otherwise-valid multi-select list", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [
          DESIGN_SPALLA.id,
          asId<"MtmPriceComponentId">("no-such-option"),
        ],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: false, reason: "design_option_not_found" });
  });

  it("refuses mixing currencies across components", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: USD_TIER.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result).toEqual({ ok: false, reason: "currency_mismatch" });
  });

  it("an empty design option list is valid — design options are optional", () => {
    const result = computeMtmQuoteTotal(
      {
        fabricTierComponentId: FABRIC_AA.id,
        garmentScopeComponentId: SCOPE_TWO_PIECE.id,
        designOptionComponentIds: [],
      },
      CATALOGUE,
    );
    expect(result.ok).toBe(true);
  });
});
