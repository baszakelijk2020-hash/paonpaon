import type {
  MtmPriceComponentId,
  MtmPriceQuoteId,
  RetailerId,
} from "../shared/branded-id";
import type { Money } from "../shared/money";
import type { Timestamps } from "../shared/timestamps";

/**
 * Every priceable dimension of an MTM order — fabric tier, make method,
 * a design option, garment scope, or a rush fee — is the SAME shape: a
 * retailer-editable, named, priced component. This is deliberate: the
 * founder's own spec names concrete categories (fabric tiers AA..WS, make
 * method, design options, urgent order, garment scope) but is explicit
 * that titles/names/prices must all stay editable without a schema
 * change. One flexible component table serving five categories, rather
 * than five rigid enums each needing a migration to rename or reprice,
 * is the actual "engine infrastructure" asked for — real price content
 * is deliberately NOT seeded here; only the category/tier system and a
 * pure calculation function are.
 */
export const MTM_PRICE_COMPONENT_CATEGORIES = [
  "fabric_tier",
  "make_method",
  "design_option",
  "garment_scope",
  "rush_fee",
] as const;
export type MtmPriceComponentCategory =
  (typeof MTM_PRICE_COMPONENT_CATEGORIES)[number];

/**
 * `fabric_tier` and `garment_scope` are the two BASE categories: a quote
 * must select exactly one of each, and their `priceImpactMinorUnits`
 * forms the starting price. `make_method` and `rush_fee` are single-select
 * ADDITIVE modifiers (at most one each). `design_option` is MULTI-select
 * additive (spalla camicia, double-breasted, etc. can combine).
 */
export function selectionRuleForCategory(
  category: MtmPriceComponentCategory,
): "base_single" | "modifier_single" | "modifier_multi" {
  switch (category) {
    case "fabric_tier":
    case "garment_scope":
      return "base_single";
    case "make_method":
    case "rush_fee":
      return "modifier_single";
    case "design_option":
      return "modifier_multi";
  }
}

export interface MtmPriceComponent extends Timestamps {
  readonly id: MtmPriceComponentId;
  readonly retailerId: RetailerId;
  readonly category: MtmPriceComponentCategory;
  /** Stable identifier a quote references — e.g. "aa", "full_canvas",
   * "spalla_camicia", "two_piece", "urgent". Renaming displayName never
   * changes this, so historical quotes keep resolving correctly. */
  readonly slug: string;
  /** Retailer-editable label shown to staff/customers — this is what
   * changes when "AA" becomes "Signature" with no other effect. */
  readonly displayName: string;
  readonly priceImpactMinorUnits: number;
  readonly currency: Money["currency"];
  readonly sortOrder: number;
  readonly active: boolean;
}

export interface MtmPriceQuoteSelection {
  readonly fabricTierComponentId: MtmPriceComponentId;
  readonly garmentScopeComponentId: MtmPriceComponentId;
  readonly makeMethodComponentId?: MtmPriceComponentId;
  readonly rushFeeComponentId?: MtmPriceComponentId;
  readonly designOptionComponentIds: readonly MtmPriceComponentId[];
}

export interface MtmPriceQuote extends Timestamps {
  readonly id: MtmPriceQuoteId;
  readonly retailerId: RetailerId;
  readonly selection: MtmPriceQuoteSelection;
  readonly totalMinorUnits: number;
  readonly currency: Money["currency"];
}

export type ComputeMtmQuoteResult =
  | { readonly ok: true; readonly totalMinorUnits: number }
  | {
      readonly ok: false;
      readonly reason:
        | "fabric_tier_not_found"
        | "fabric_tier_wrong_category"
        | "fabric_tier_inactive"
        | "garment_scope_not_found"
        | "garment_scope_wrong_category"
        | "garment_scope_inactive"
        | "make_method_not_found"
        | "make_method_wrong_category"
        | "make_method_inactive"
        | "rush_fee_not_found"
        | "rush_fee_wrong_category"
        | "rush_fee_inactive"
        | "design_option_not_found"
        | "design_option_wrong_category"
        | "design_option_inactive"
        | "currency_mismatch";
    };

/**
 * Pure calculation — every selected component must exist, belong to the
 * category it was selected for, be active, and share one currency. A
 * retired/deactivated component (e.g. a discontinued fabric tier) can
 * never silently price an order again; the caller gets a named reason,
 * never a fabricated total.
 */
export function computeMtmQuoteTotal(
  selection: MtmPriceQuoteSelection,
  components: readonly MtmPriceComponent[],
): ComputeMtmQuoteResult {
  const byId = new Map(components.map((c) => [c.id, c]));

  function resolveBase(
    id: MtmPriceComponentId,
    category: MtmPriceComponentCategory,
    notFound: ComputeMtmQuoteResult & { ok: false },
    wrongCategory: ComputeMtmQuoteResult & { ok: false },
    inactive: ComputeMtmQuoteResult & { ok: false },
  ): MtmPriceComponent | ComputeMtmQuoteResult {
    const component = byId.get(id);
    if (!component) return notFound;
    if (component.category !== category) return wrongCategory;
    if (!component.active) return inactive;
    return component;
  }

  const fabricTier = resolveBase(
    selection.fabricTierComponentId,
    "fabric_tier",
    { ok: false, reason: "fabric_tier_not_found" },
    { ok: false, reason: "fabric_tier_wrong_category" },
    { ok: false, reason: "fabric_tier_inactive" },
  );
  if (!("id" in fabricTier)) return fabricTier;

  const garmentScope = resolveBase(
    selection.garmentScopeComponentId,
    "garment_scope",
    { ok: false, reason: "garment_scope_not_found" },
    { ok: false, reason: "garment_scope_wrong_category" },
    { ok: false, reason: "garment_scope_inactive" },
  );
  if (!("id" in garmentScope)) return garmentScope;

  const currency = fabricTier.currency;
  if (garmentScope.currency !== currency) {
    return { ok: false, reason: "currency_mismatch" };
  }

  let total =
    fabricTier.priceImpactMinorUnits + garmentScope.priceImpactMinorUnits;

  if (selection.makeMethodComponentId) {
    const makeMethod = resolveBase(
      selection.makeMethodComponentId,
      "make_method",
      { ok: false, reason: "make_method_not_found" },
      { ok: false, reason: "make_method_wrong_category" },
      { ok: false, reason: "make_method_inactive" },
    );
    if (!("id" in makeMethod)) return makeMethod;
    if (makeMethod.currency !== currency) {
      return { ok: false, reason: "currency_mismatch" };
    }
    total += makeMethod.priceImpactMinorUnits;
  }

  if (selection.rushFeeComponentId) {
    const rushFee = resolveBase(
      selection.rushFeeComponentId,
      "rush_fee",
      { ok: false, reason: "rush_fee_not_found" },
      { ok: false, reason: "rush_fee_wrong_category" },
      { ok: false, reason: "rush_fee_inactive" },
    );
    if (!("id" in rushFee)) return rushFee;
    if (rushFee.currency !== currency) {
      return { ok: false, reason: "currency_mismatch" };
    }
    total += rushFee.priceImpactMinorUnits;
  }

  for (const designOptionId of selection.designOptionComponentIds) {
    const designOption = resolveBase(
      designOptionId,
      "design_option",
      { ok: false, reason: "design_option_not_found" },
      { ok: false, reason: "design_option_wrong_category" },
      { ok: false, reason: "design_option_inactive" },
    );
    if (!("id" in designOption)) return designOption;
    if (designOption.currency !== currency) {
      return { ok: false, reason: "currency_mismatch" };
    }
    total += designOption.priceImpactMinorUnits;
  }

  return { ok: true, totalMinorUnits: total };
}
