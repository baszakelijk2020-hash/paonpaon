/**
 * MorningRoutine selection and explainable actions (MR-001, MR-002, ENG-002 /
 * PHASE 4.4 / ADR-061, ADR-063).
 *
 * Pure ranking: owned available garments first, catalogue secondary.
 * Consented StyleProfile / occasion / weather / location inputs are optional
 * and always traceable. Provider SDKs stay outside this module.
 */

import type { CalendarOccasion } from "../integrations/calendar";
import type { WeatherSnapshot } from "../integrations/weather";
import type { ConsentSnapshot, ConsentStatus } from "../intelligence/consent";
import type {
  CustomerId,
  MorningRoutineRecommendationId,
  MorningRoutineSelectionId,
  ProductId,
  ProductVariantId,
  RetailerId,
  WardrobeItemId,
} from "../shared/branded-id";

import type {
  GarmentCategoryCode,
  WardrobeCareState,
  WardrobeConditionState,
} from "./wardrobe";

export const MORNING_ROUTINE_ITEM_SOURCES = ["owned", "catalogue"] as const;

export type MorningRoutineItemSource =
  (typeof MORNING_ROUTINE_ITEM_SOURCES)[number];

export const MORNING_ROUTINE_ACTION_KINDS = [
  "save",
  "review",
  "book",
  "buy",
] as const;

export type MorningRoutineActionKind =
  (typeof MORNING_ROUTINE_ACTION_KINDS)[number];

export const MORNING_ROUTINE_LOCATION_KINDS = [
  "none",
  "store_city",
  "consented_label",
] as const;

export type MorningRoutineLocationKind =
  (typeof MORNING_ROUTINE_LOCATION_KINDS)[number];

export const MORNING_ROUTINE_INPUT_STATUSES = [
  "used",
  "skipped_no_consent",
  "skipped_unavailable",
  "skipped_failed",
  "skipped_absent",
] as const;

export type MorningRoutineInputStatus =
  (typeof MORNING_ROUTINE_INPUT_STATUSES)[number];

export const MORNING_ROUTINE_REVIEW_STATUSES = [
  "none",
  "saved",
  "reviewed",
] as const;

export type MorningRoutineReviewStatus =
  (typeof MORNING_ROUTINE_REVIEW_STATUSES)[number];

export interface MorningRoutineWardrobeCandidate {
  readonly wardrobeItemId: WardrobeItemId | string;
  readonly displayName: string;
  readonly categoryCode: GarmentCategoryCode;
  readonly condition: WardrobeConditionState;
  readonly careState: WardrobeCareState;
  readonly retiredAt?: string | null;
  readonly deletedAt?: string | null;
  readonly productId?: ProductId | string;
  readonly conceptIds?: readonly string[];
  /** Soft flag from lifecycle — garment resting after recent wear. */
  readonly resting?: boolean;
}

export interface MorningRoutineCatalogueCandidate {
  readonly productId: ProductId | string;
  readonly productVariantId?: ProductVariantId | string;
  readonly displayName: string;
  readonly productSlug: string;
  readonly categoryCode?: GarmentCategoryCode;
  readonly conceptIds?: readonly string[];
  readonly available: boolean;
  readonly primaryImageUrl?: string;
}

export interface MorningRoutineStyleSignals {
  readonly declaredConceptIds: readonly string[];
  readonly inferredPositiveConceptIds: readonly string[];
  readonly inferredNegativeConceptIds: readonly string[];
}

export interface MorningRoutineLocationInput {
  readonly kind: MorningRoutineLocationKind;
  readonly label?: string;
}

export interface MorningRoutineSelectionInput {
  readonly retailerId: RetailerId | string;
  readonly customerId: CustomerId | string;
  readonly forDate: string;
  readonly consent: ConsentSnapshot;
  readonly wardrobe: readonly MorningRoutineWardrobeCandidate[];
  readonly catalogue: readonly MorningRoutineCatalogueCandidate[];
  readonly styleProfile?: MorningRoutineStyleSignals | null;
  readonly weather?: WeatherSnapshot | null;
  readonly weatherStatus: MorningRoutineInputStatus;
  readonly occasions: readonly CalendarOccasion[];
  readonly calendarStatus: MorningRoutineInputStatus;
  readonly location: MorningRoutineLocationInput;
  readonly locationStatus: MorningRoutineInputStatus;
  readonly personalizationStatus: MorningRoutineInputStatus;
  readonly maxRecommendations?: number;
}

export interface MorningRoutineAction {
  readonly kind: MorningRoutineActionKind;
  readonly available: boolean;
  /** Why the action is absent when available is false. */
  readonly reason?: string;
  readonly href?: string;
  readonly productId?: string;
  readonly productVariantId?: string;
  readonly wardrobeItemId?: string;
}

export interface MorningRoutineExplanationFactor {
  readonly code:
    | "owned_available"
    | "catalogue_secondary"
    | "weather"
    | "occasion"
    | "style_declared"
    | "style_inferred"
    | "unavailable"
    | "consent_fallback"
    | "resting"
    | "care_state";
  readonly detail: string;
}

export interface MorningRoutineRecommendation {
  readonly rank: number;
  readonly source: MorningRoutineItemSource;
  readonly displayName: string;
  readonly categoryCode?: GarmentCategoryCode;
  readonly score: number;
  readonly wardrobeItemId?: WardrobeItemId | string;
  readonly productId?: ProductId | string;
  readonly productVariantId?: ProductVariantId | string;
  readonly productSlug?: string;
  readonly primaryImageUrl?: string;
  readonly explanation: readonly string[];
  readonly factors: readonly MorningRoutineExplanationFactor[];
  readonly actions: readonly MorningRoutineAction[];
}

export interface MorningRoutineInputProvenance {
  readonly personalizationConsent: ConsentStatus;
  readonly locationConsent: ConsentStatus;
  readonly personalizationStatus: MorningRoutineInputStatus;
  readonly locationStatus: MorningRoutineInputStatus;
  readonly locationKind: MorningRoutineLocationKind;
  readonly locationLabel?: string;
  readonly weatherStatus: MorningRoutineInputStatus;
  readonly weatherSummary?: string;
  readonly calendarStatus: MorningRoutineInputStatus;
  readonly occasionLabels: readonly string[];
}

export interface MorningRoutineSelection {
  readonly retailerId: RetailerId | string;
  readonly customerId: CustomerId | string;
  readonly forDate: string;
  readonly summary: string;
  readonly recommendations: readonly MorningRoutineRecommendation[];
  readonly provenance: MorningRoutineInputProvenance;
}

export interface PersistedMorningRoutineSelection extends MorningRoutineSelection {
  readonly id: MorningRoutineSelectionId;
  readonly reviewStatus: MorningRoutineReviewStatus;
  readonly createdAt: string;
}

export interface PersistedMorningRoutineRecommendation extends MorningRoutineRecommendation {
  readonly id: MorningRoutineRecommendationId;
  readonly selectionId: MorningRoutineSelectionId;
}

const COLD_CATEGORIES: ReadonlySet<GarmentCategoryCode> = new Set([
  "overcoat",
  "coat",
  "knitwear",
  "leather",
  "jacket",
]);

const WARM_CATEGORIES: ReadonlySet<GarmentCategoryCode> = new Set([
  "shirt",
  "trousers",
  "denim",
  "accessories",
  "pocket_square",
]);

const FORMAL_CATEGORIES: ReadonlySet<GarmentCategoryCode> = new Set([
  "suit",
  "formalwear",
  "waistcoat",
  "jacket",
  "shirt",
  "shoes",
  "pocket_square",
]);

const OCCASION_FORMAL_HINTS = [
  "wedding",
  "formal",
  "black tie",
  "ceremony",
  "fitting",
  "consultation",
] as const;

function isOwnedAvailable(candidate: MorningRoutineWardrobeCandidate): {
  available: boolean;
  reason?: string;
} {
  if (candidate.deletedAt) {
    return { available: false, reason: "Item is no longer in the wardrobe." };
  }
  if (candidate.retiredAt || candidate.condition === "retired") {
    return { available: false, reason: "Item is retired." };
  }
  if (candidate.careState === "in_service") {
    return { available: false, reason: "Item is currently in service." };
  }
  return { available: true };
}

function weatherBoost(
  category: GarmentCategoryCode | undefined,
  weather: WeatherSnapshot | null | undefined,
): MorningRoutineExplanationFactor | null {
  if (!category || !weather) return null;
  const rainy = /rain|drizzle|storm|shower/i.test(weather.description);
  if (rainy && (category === "overcoat" || category === "coat")) {
    return {
      code: "weather",
      detail: `Weather (${weather.temperatureCelsius}°C, ${weather.description}) favours an all-weather coat.`,
    };
  }
  if (weather.temperatureCelsius <= 12 && COLD_CATEGORIES.has(category)) {
    return {
      code: "weather",
      detail: `Cool conditions (${weather.temperatureCelsius}°C) suit this layer.`,
    };
  }
  if (weather.temperatureCelsius >= 22 && WARM_CATEGORIES.has(category)) {
    return {
      code: "weather",
      detail: `Warmer conditions (${weather.temperatureCelsius}°C) suit a lighter piece.`,
    };
  }
  return null;
}

function occasionBoost(
  category: GarmentCategoryCode | undefined,
  occasions: readonly CalendarOccasion[],
): MorningRoutineExplanationFactor | null {
  if (!category || occasions.length === 0) return null;
  const formal = occasions.find((occasion) =>
    OCCASION_FORMAL_HINTS.some((hint) =>
      occasion.label.toLowerCase().includes(hint),
    ),
  );
  if (formal && FORMAL_CATEGORIES.has(category)) {
    return {
      code: "occasion",
      detail: `Today's calendar includes “${formal.label}”, which suits this category.`,
    };
  }
  if (!formal) {
    const first = occasions[0];
    if (!first) return null;
    return {
      code: "occasion",
      detail: `Calendar context “${first.label}” is considered.`,
    };
  }
  return null;
}

function styleBoost(
  conceptIds: readonly string[] | undefined,
  style: MorningRoutineStyleSignals | null | undefined,
  personalizationStatus: MorningRoutineInputStatus,
): {
  score: number;
  factors: MorningRoutineExplanationFactor[];
} {
  if (personalizationStatus !== "used" || !style) {
    return {
      score: 0,
      factors:
        personalizationStatus === "skipped_no_consent"
          ? [
              {
                code: "consent_fallback",
                detail:
                  "StyleProfile omitted — personalization consent is not granted.",
              },
            ]
          : [],
    };
  }
  const ids = new Set(conceptIds ?? []);
  if (ids.size === 0) return { score: 0, factors: [] };

  const factors: MorningRoutineExplanationFactor[] = [];
  let score = 0;
  const declaredHit = style.declaredConceptIds.some((id) => ids.has(id));
  if (declaredHit) {
    score += 18;
    factors.push({
      code: "style_declared",
      detail: "Matches a preference you declared.",
    });
  }
  const inferredHit = style.inferredPositiveConceptIds.some((id) =>
    ids.has(id),
  );
  if (inferredHit) {
    score += 10;
    factors.push({
      code: "style_inferred",
      detail: "Aligns with consented inferred preferences.",
    });
  }
  const negativeHit = style.inferredNegativeConceptIds.some((id) =>
    ids.has(id),
  );
  if (negativeHit) {
    score -= 20;
    factors.push({
      code: "style_inferred",
      detail: "Down-ranked — conflicts with a negative inferred preference.",
    });
  }
  return { score, factors };
}

function buildActions(args: {
  readonly source: MorningRoutineItemSource;
  readonly wardrobeItemId?: string;
  readonly productId?: string;
  readonly productVariantId?: string;
  readonly productSlug?: string;
  readonly retailerSlug?: string;
}): MorningRoutineAction[] {
  const storeBase = args.retailerSlug ? `/r/${args.retailerSlug}` : undefined;
  const buyHref =
    storeBase && args.productSlug
      ? `${storeBase}/products/${args.productSlug}?legacy=1`
      : storeBase;

  let save: MorningRoutineAction;
  if (args.source === "catalogue" && args.productVariantId) {
    save = {
      kind: "save",
      available: true,
      productVariantId: args.productVariantId,
      ...(args.productId ? { productId: args.productId } : {}),
    };
  } else if (args.source === "owned") {
    save = {
      kind: "save",
      available: true,
      reason: "Mark this owned recommendation as saved for today.",
      ...(args.wardrobeItemId ? { wardrobeItemId: args.wardrobeItemId } : {}),
    };
  } else {
    save = {
      kind: "save",
      available: false,
      reason: "Save requires a catalogue variant or owned item.",
      ...(args.productId ? { productId: args.productId } : {}),
    };
  }

  const review: MorningRoutineAction = {
    kind: "review",
    available: true,
    reason: "Ask your Style Advisor about this pick.",
    ...(args.wardrobeItemId ? { wardrobeItemId: args.wardrobeItemId } : {}),
    ...(args.productId ? { productId: args.productId } : {}),
  };

  const book: MorningRoutineAction = {
    kind: "book",
    available: Boolean(storeBase),
    ...(storeBase
      ? { href: `${storeBase}/appointments` }
      : { reason: "Booking link needs the retailer storefront slug." }),
    ...(args.wardrobeItemId ? { wardrobeItemId: args.wardrobeItemId } : {}),
  };

  const buy: MorningRoutineAction =
    args.source === "catalogue" && args.productId
      ? {
          kind: "buy",
          available: Boolean(buyHref),
          ...(buyHref
            ? { href: buyHref }
            : { reason: "Storefront link unavailable." }),
          productId: args.productId,
          ...(args.productVariantId
            ? { productVariantId: args.productVariantId }
            : {}),
        }
      : {
          kind: "buy",
          available: false,
          reason:
            args.source === "owned"
              ? "Owned garments are already in your wardrobe."
              : "Purchase path requires a catalogue product.",
        };

  return [save, review, book, buy];
}

interface ScoredCandidate {
  readonly source: MorningRoutineItemSource;
  readonly displayName: string;
  readonly categoryCode?: GarmentCategoryCode;
  readonly score: number;
  readonly wardrobeItemId?: string;
  readonly productId?: string;
  readonly productVariantId?: string;
  readonly productSlug?: string;
  readonly primaryImageUrl?: string;
  readonly factors: MorningRoutineExplanationFactor[];
}

/**
 * Deterministic MorningRoutine selector. Owned available garments always
 * outrank catalogue items at equal relevance; unavailable garments are
 * excluded with an explanation path via provenance, not silent omission
 * of the whole result.
 */
export function selectMorningRoutine(
  input: MorningRoutineSelectionInput,
): MorningRoutineSelection {
  const max = input.maxRecommendations ?? 5;
  const weather =
    input.weatherStatus === "used" ? (input.weather ?? null) : null;
  const occasions =
    input.calendarStatus === "used" ? input.occasions : ([] as const);
  const style =
    input.personalizationStatus === "used"
      ? (input.styleProfile ?? null)
      : null;

  const scored: ScoredCandidate[] = [];

  for (const item of input.wardrobe) {
    const availability = isOwnedAvailable(item);
    if (!availability.available) continue;

    const factors: MorningRoutineExplanationFactor[] = [
      {
        code: "owned_available",
        detail: "Owned garment available in your wardrobe — ranked first.",
      },
    ];
    let score = 100;

    if (item.careState === "needs_attention" || item.careState === "due_soon") {
      score -= 8;
      factors.push({
        code: "care_state",
        detail: `Care state is ${item.careState.replaceAll("_", " ")}.`,
      });
    }
    if (item.resting) {
      score -= 12;
      factors.push({
        code: "resting",
        detail: "Recently worn — resting preferred for longevity.",
      });
    }

    const weatherFactor = weatherBoost(item.categoryCode, weather);
    if (weatherFactor) {
      score += 16;
      factors.push(weatherFactor);
    }
    const occasionFactor = occasionBoost(item.categoryCode, occasions);
    if (occasionFactor) {
      score += 14;
      factors.push(occasionFactor);
    }
    const styleResult = styleBoost(
      item.conceptIds,
      style,
      input.personalizationStatus,
    );
    score += styleResult.score;
    factors.push(...styleResult.factors);

    scored.push({
      source: "owned",
      displayName: item.displayName,
      categoryCode: item.categoryCode,
      score,
      wardrobeItemId: String(item.wardrobeItemId),
      ...(item.productId ? { productId: String(item.productId) } : {}),
      factors,
    });
  }

  for (const product of input.catalogue) {
    if (!product.available) continue;
    const factors: MorningRoutineExplanationFactor[] = [
      {
        code: "catalogue_secondary",
        detail: "Catalogue recommendation — secondary to owned pieces.",
      },
    ];
    let score = 40;

    const weatherFactor = weatherBoost(product.categoryCode, weather);
    if (weatherFactor) {
      score += 16;
      factors.push(weatherFactor);
    }
    const occasionFactor = occasionBoost(product.categoryCode, occasions);
    if (occasionFactor) {
      score += 14;
      factors.push(occasionFactor);
    }
    const styleResult = styleBoost(
      product.conceptIds,
      style,
      input.personalizationStatus,
    );
    score += styleResult.score;
    factors.push(...styleResult.factors);

    scored.push({
      source: "catalogue",
      displayName: product.displayName,
      ...(product.categoryCode ? { categoryCode: product.categoryCode } : {}),
      score,
      productId: String(product.productId),
      ...(product.productVariantId
        ? { productVariantId: String(product.productVariantId) }
        : {}),
      productSlug: product.productSlug,
      ...(product.primaryImageUrl
        ? { primaryImageUrl: product.primaryImageUrl }
        : {}),
      factors,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.source !== b.source) return a.source === "owned" ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const recommendations: MorningRoutineRecommendation[] = scored
    .slice(0, max)
    .map((candidate, index) => {
      const explanation = candidate.factors.map((factor) => factor.detail);
      return {
        rank: index + 1,
        source: candidate.source,
        displayName: candidate.displayName,
        ...(candidate.categoryCode
          ? { categoryCode: candidate.categoryCode }
          : {}),
        score: candidate.score,
        ...(candidate.wardrobeItemId
          ? { wardrobeItemId: candidate.wardrobeItemId }
          : {}),
        ...(candidate.productId ? { productId: candidate.productId } : {}),
        ...(candidate.productVariantId
          ? { productVariantId: candidate.productVariantId }
          : {}),
        ...(candidate.productSlug
          ? { productSlug: candidate.productSlug }
          : {}),
        ...(candidate.primaryImageUrl
          ? { primaryImageUrl: candidate.primaryImageUrl }
          : {}),
        explanation,
        factors: candidate.factors,
        actions: buildActions({
          source: candidate.source,
          ...(candidate.wardrobeItemId
            ? { wardrobeItemId: candidate.wardrobeItemId }
            : {}),
          ...(candidate.productId ? { productId: candidate.productId } : {}),
          ...(candidate.productVariantId
            ? { productVariantId: candidate.productVariantId }
            : {}),
          ...(candidate.productSlug
            ? { productSlug: candidate.productSlug }
            : {}),
        }),
      };
    });

  const provenance: MorningRoutineInputProvenance = {
    personalizationConsent: input.consent.personalization,
    locationConsent: input.consent.location,
    personalizationStatus: input.personalizationStatus,
    locationStatus: input.locationStatus,
    locationKind: input.location.kind,
    ...(input.location.label ? { locationLabel: input.location.label } : {}),
    weatherStatus: input.weatherStatus,
    ...(weather
      ? {
          weatherSummary: `${weather.temperatureCelsius}°C, ${weather.description}`,
        }
      : {}),
    calendarStatus: input.calendarStatus,
    occasionLabels: occasions.map((occasion) => occasion.label),
  };

  const ownedCount = recommendations.filter((r) => r.source === "owned").length;
  const catalogueCount = recommendations.length - ownedCount;
  const summaryParts: string[] = [];
  if (recommendations.length === 0) {
    summaryParts.push(
      "No available owned garments or catalogue pieces matched today’s inputs.",
    );
  } else {
    summaryParts.push(
      `Selected ${ownedCount} owned and ${catalogueCount} catalogue recommendation${catalogueCount === 1 ? "" : "s"}.`,
    );
  }
  if (provenance.weatherSummary) {
    summaryParts.push(`Weather: ${provenance.weatherSummary}.`);
  } else if (input.weatherStatus === "skipped_no_consent") {
    summaryParts.push("Weather skipped — location consent not granted.");
  } else if (input.weatherStatus !== "used") {
    summaryParts.push("Weather unavailable; selection continues without it.");
  }
  if (provenance.occasionLabels.length > 0) {
    summaryParts.push(`Calendar: ${provenance.occasionLabels.join(", ")}.`);
  }

  return {
    retailerId: input.retailerId,
    customerId: input.customerId,
    forDate: input.forDate,
    summary: summaryParts.join(" "),
    recommendations,
    provenance,
  };
}

/**
 * Resolve input statuses from consent + provider outcomes without inventing
 * weather or location data.
 */
export function resolveMorningRoutineInputStatuses(args: {
  readonly consent: ConsentSnapshot;
  readonly locationKind: MorningRoutineLocationKind;
  readonly locationLabel?: string;
  readonly weather: WeatherSnapshot | null;
  readonly weatherFailed?: boolean;
  readonly occasions: readonly CalendarOccasion[];
  readonly calendarFailed?: boolean;
  readonly styleProfilePresent: boolean;
}): {
  readonly personalizationStatus: MorningRoutineInputStatus;
  readonly locationStatus: MorningRoutineInputStatus;
  readonly weatherStatus: MorningRoutineInputStatus;
  readonly calendarStatus: MorningRoutineInputStatus;
  readonly location: MorningRoutineLocationInput;
} {
  const personalizationGranted = args.consent.personalization === "granted";
  const locationGranted = args.consent.location === "granted";

  const personalizationStatus: MorningRoutineInputStatus =
    !personalizationGranted
      ? "skipped_no_consent"
      : args.styleProfilePresent
        ? "used"
        : "skipped_absent";

  const location: MorningRoutineLocationInput = locationGranted
    ? {
        kind:
          args.locationKind === "none" ? "consented_label" : args.locationKind,
        ...(args.locationLabel ? { label: args.locationLabel } : {}),
      }
    : { kind: "none" };

  const locationStatus: MorningRoutineInputStatus = !locationGranted
    ? "skipped_no_consent"
    : args.locationLabel
      ? "used"
      : "skipped_absent";

  let weatherStatus: MorningRoutineInputStatus;
  if (!locationGranted) {
    weatherStatus = "skipped_no_consent";
  } else if (args.weatherFailed) {
    weatherStatus = "skipped_failed";
  } else if (!args.weather) {
    weatherStatus = "skipped_unavailable";
  } else {
    weatherStatus = "used";
  }

  let calendarStatus: MorningRoutineInputStatus;
  if (args.calendarFailed) {
    calendarStatus = "skipped_failed";
  } else if (args.occasions.length === 0) {
    calendarStatus = "skipped_absent";
  } else {
    calendarStatus = "used";
  }

  return {
    personalizationStatus,
    locationStatus,
    weatherStatus,
    calendarStatus,
    location,
  };
}

export function attachRetailerSlugToActions(
  selection: MorningRoutineSelection,
  retailerSlug: string,
): MorningRoutineSelection {
  return {
    ...selection,
    recommendations: selection.recommendations.map((recommendation) => ({
      ...recommendation,
      actions: buildActions({
        source: recommendation.source,
        ...(recommendation.wardrobeItemId
          ? { wardrobeItemId: String(recommendation.wardrobeItemId) }
          : {}),
        ...(recommendation.productId
          ? { productId: String(recommendation.productId) }
          : {}),
        ...(recommendation.productVariantId
          ? { productVariantId: String(recommendation.productVariantId) }
          : {}),
        ...(recommendation.productSlug
          ? { productSlug: recommendation.productSlug }
          : {}),
        retailerSlug,
      }),
    })),
  };
}
