/**
 * MorningRoutine deterministic selection and explanation (MR-001, MR-002,
 * ENG-002 / PHASE 4.4 / ADR-061, ADR-063). Owned available garments rank
 * first; catalogue items fill gaps second. Every input is traceable; consent
 * gates StyleProfile and location; results expose save/review/book/buy where
 * valid.
 */

import type { GarmentCategoryCode } from "../production/production";
import type {
  CustomerId,
  MetadataConceptId,
  ProductId,
  ProductVariantId,
  RetailerId,
  WardrobeItemId,
} from "../shared/branded-id";
import type { OutfitSlotKind } from "../wardrobe/sartorial";
import { garmentCategoryToOutfitSlot } from "../wardrobe/sartorial";
import type {
  WardrobeCareState,
  WardrobeConditionState,
  WardrobeItem,
} from "../wardrobe/wardrobe";

import {
  mayCapturePersonalizationForCustomer,
  type CustomerConsentState,
} from "./consent";
import type {
  MorningRoutineCalendarEvent,
  MorningRoutineInputProvenanceEntry,
  MorningRoutineWeatherSnapshot,
} from "./morning-routine-providers";
import type { CustomerStyleProfile } from "./style-profile";

export {
  fixtureCalendarProvider,
  fixtureWeatherProvider,
  failingCalendarProvider,
  failingWeatherProvider,
  type MorningRoutineCalendarEvent,
  type MorningRoutineCalendarProvider,
  type MorningRoutineCalendarRequest,
  type MorningRoutineCalendarResult,
  type MorningRoutineInputProvenanceEntry,
  type MorningRoutineInputSource,
  type MorningRoutineWeatherProvider,
  type MorningRoutineWeatherRequest,
  type MorningRoutineWeatherResult,
  type MorningRoutineWeatherSnapshot,
} from "./morning-routine-providers";

export const MORNING_ROUTINE_ITEM_KINDS = [
  "owned_wardrobe",
  "catalogue_product",
] as const;

export type MorningRoutineItemKind =
  (typeof MORNING_ROUTINE_ITEM_KINDS)[number];

export const MORNING_ROUTINE_ACTION_KINDS = [
  "save",
  "review",
  "book",
  "buy",
] as const;

export type MorningRoutineActionKind =
  (typeof MORNING_ROUTINE_ACTION_KINDS)[number];

export const MORNING_ROUTINE_SCORE_FACTORS = [
  "owned_priority",
  "catalogue_gap_fill",
  "style_preference_match",
  "weather_suitability",
  "occasion_match",
  "availability",
  "unavailable_penalty",
  "withdrawn_consent_excluded",
] as const;

export type MorningRoutineScoreFactorCode =
  (typeof MORNING_ROUTINE_SCORE_FACTORS)[number];

export interface MorningRoutineScoreFactor {
  readonly code: MorningRoutineScoreFactorCode;
  readonly delta: number;
  readonly detail: string;
}

export interface MorningRoutineWardrobeCandidate {
  readonly kind: "owned_wardrobe";
  readonly wardrobeItemId: WardrobeItemId;
  readonly label: string;
  readonly categoryCode: GarmentCategoryCode;
  readonly slotKind: OutfitSlotKind;
  readonly available: boolean;
  readonly productId?: ProductId;
  readonly imageUrl?: string;
}

export interface MorningRoutineCatalogueCandidate {
  readonly kind: "catalogue_product";
  readonly productId: ProductId;
  readonly productVariantId: ProductVariantId;
  readonly label: string;
  readonly slug: string;
  readonly slotKind: OutfitSlotKind;
  readonly available: boolean;
  readonly priceCents?: number;
  readonly imageUrl?: string;
  readonly matchedConceptIds?: readonly MetadataConceptId[];
}

export type MorningRoutineCandidate =
  MorningRoutineWardrobeCandidate | MorningRoutineCatalogueCandidate;

export interface MorningRoutineAction {
  readonly kind: MorningRoutineActionKind;
  readonly label: string;
  readonly href?: string;
  readonly enabled: boolean;
  readonly reason?: string;
}

export interface MorningRoutineRecommendationItem {
  readonly candidate: MorningRoutineCandidate;
  readonly score: number;
  readonly factors: readonly MorningRoutineScoreFactor[];
  readonly actions: readonly MorningRoutineAction[];
}

export interface MorningRoutineRecommendation {
  readonly title: string;
  readonly summary: string;
  readonly items: readonly MorningRoutineRecommendationItem[];
  readonly factors: readonly MorningRoutineScoreFactor[];
  readonly score: number;
}

export interface MorningRoutineSelectionRequest {
  readonly retailerId: RetailerId;
  readonly customerId: CustomerId;
  readonly consent: CustomerConsentState;
  readonly wardrobe: readonly MorningRoutineWardrobeCandidate[];
  readonly catalogue: readonly MorningRoutineCatalogueCandidate[];
  readonly styleProfile?: CustomerStyleProfile;
  readonly styleConceptLabels?: ReadonlyMap<string, string>;
  readonly weather?: MorningRoutineWeatherSnapshot | null;
  readonly occasion?: MorningRoutineCalendarEvent | null;
  readonly provenance: readonly MorningRoutineInputProvenanceEntry[];
  readonly maxRecommendations?: number;
}

export interface MorningRoutineSelectionResult {
  readonly recommendations: readonly MorningRoutineRecommendation[];
  readonly provenance: readonly MorningRoutineInputProvenanceEntry[];
  readonly personalizationUsed: boolean;
  readonly locationUsed: boolean;
}

const CORE_SLOTS: readonly OutfitSlotKind[] = [
  "jacket",
  "trousers",
  "shirt",
  "shoes",
];

const OWNED_BASE_SCORE = 1000;
const CATALOGUE_BASE_SCORE = 100;

export function isWardrobeItemAvailableForRoutine(item: {
  readonly retiredAt?: string | null;
  readonly deletedAt?: string | null;
  readonly condition: WardrobeConditionState;
  readonly careState: WardrobeCareState;
}): boolean {
  if (item.retiredAt || item.deletedAt) return false;
  if (item.condition === "retired") return false;
  if (item.careState === "in_service") return false;
  return true;
}

export function projectWardrobeCandidate(
  item: WardrobeItem,
): MorningRoutineWardrobeCandidate | null {
  const slotKind = garmentCategoryToOutfitSlot(item.categoryCode);
  if (!slotKind) return null;
  const available = isWardrobeItemAvailableForRoutine(item);
  return {
    kind: "owned_wardrobe",
    wardrobeItemId: item.id,
    label: item.displayName,
    categoryCode: item.categoryCode,
    slotKind,
    available,
    ...(item.productId ? { productId: item.productId } : {}),
    ...(item.identifyingPhotoUrl ? { imageUrl: item.identifyingPhotoUrl } : {}),
  };
}

function warmWeatherBonus(temperatureCelsius: number): number {
  if (temperatureCelsius >= 22) return 0.4;
  if (temperatureCelsius >= 16) return 0.2;
  if (temperatureCelsius <= 8) return 0.3;
  return 0;
}

function occasionBonus(
  occasion: MorningRoutineCalendarEvent | null | undefined,
  slotKind: OutfitSlotKind,
): number {
  if (!occasion) return 0;
  const label = occasion.label.toLowerCase();
  if (label.includes("wedding") || label.includes("formal")) {
    return slotKind === "jacket" || slotKind === "trousers" ? 0.5 : 0.2;
  }
  if (label.includes("fitting") || label.includes("appointment")) {
    return slotKind === "jacket" ? 0.3 : 0.1;
  }
  return 0.15;
}

function stylePreferenceBonus(
  candidate: MorningRoutineCandidate,
  styleProfile: CustomerStyleProfile | undefined,
  conceptLabels: ReadonlyMap<string, string> | undefined,
): MorningRoutineScoreFactor | null {
  if (!styleProfile) return null;
  const positiveConcepts = new Set([
    ...styleProfile.explicitPreferences
      .filter((pref) => pref.polarity === "positive")
      .map((pref) => pref.conceptId),
    ...styleProfile.inferredPreferences
      .filter((pref) => pref.polarity === "positive")
      .map((pref) => pref.conceptId),
  ]);
  if (positiveConcepts.size === 0) return null;

  if (candidate.kind === "catalogue_product" && candidate.matchedConceptIds) {
    const matched = candidate.matchedConceptIds.filter((id) =>
      positiveConcepts.has(id),
    );
    if (matched.length === 0) return null;
    const label =
      conceptLabels?.get(matched[0] ?? "") ?? "your saved preferences";
    return {
      code: "style_preference_match",
      delta: 0.6 * matched.length,
      detail: `Aligns with ${label}`,
    };
  }

  return null;
}

function scoreCandidate(args: {
  readonly candidate: MorningRoutineCandidate;
  readonly consent: CustomerConsentState;
  readonly styleProfile?: CustomerStyleProfile;
  readonly styleConceptLabels?: ReadonlyMap<string, string>;
  readonly weather?: MorningRoutineWeatherSnapshot | null;
  readonly occasion?: MorningRoutineCalendarEvent | null;
}): { readonly score: number; readonly factors: MorningRoutineScoreFactor[] } {
  const factors: MorningRoutineScoreFactor[] = [];
  let score =
    args.candidate.kind === "owned_wardrobe"
      ? OWNED_BASE_SCORE
      : CATALOGUE_BASE_SCORE;

  factors.push({
    code:
      args.candidate.kind === "owned_wardrobe"
        ? "owned_priority"
        : "catalogue_gap_fill",
    delta: score,
    detail:
      args.candidate.kind === "owned_wardrobe"
        ? "Owned garment ranks ahead of catalogue suggestions"
        : "Catalogue item suggested to complete the look",
  });

  if (!args.candidate.available) {
    factors.push({
      code: "unavailable_penalty",
      delta: -500,
      detail: "Item is currently unavailable",
    });
    score -= 500;
  } else {
    factors.push({
      code: "availability",
      delta: 0.2,
      detail: "Available to wear or purchase today",
    });
    score += 0.2;
  }

  if (args.weather) {
    const weatherDelta = warmWeatherBonus(args.weather.temperatureCelsius);
    if (weatherDelta > 0) {
      factors.push({
        code: "weather_suitability",
        delta: weatherDelta,
        detail: `${args.weather.temperatureCelsius}°C — ${args.weather.description}`,
      });
      score += weatherDelta;
    }
  }

  const occasionDelta = occasionBonus(args.occasion, args.candidate.slotKind);
  if (occasionDelta > 0 && args.occasion) {
    factors.push({
      code: "occasion_match",
      delta: occasionDelta,
      detail: `Supports ${args.occasion.label}`,
    });
    score += occasionDelta;
  }

  if (mayCapturePersonalizationForCustomer(args.consent) && args.styleProfile) {
    const styleFactor = stylePreferenceBonus(
      args.candidate,
      args.styleProfile,
      args.styleConceptLabels,
    );
    if (styleFactor) {
      factors.push(styleFactor);
      score += styleFactor.delta;
    }
  } else if (
    args.styleProfile &&
    !mayCapturePersonalizationForCustomer(args.consent)
  ) {
    factors.push({
      code: "withdrawn_consent_excluded",
      delta: 0,
      detail:
        "Style preferences excluded — personalization consent not granted",
    });
  }

  return { score, factors };
}

function buildActions(args: {
  readonly candidate: MorningRoutineCandidate;
  readonly slug: string;
}): MorningRoutineAction[] {
  if (args.candidate.kind === "owned_wardrobe") {
    return [
      {
        kind: "review",
        label: "Review in wardrobe",
        href: "/wardrobe",
        enabled: true,
      },
      {
        kind: "book",
        label: "Book a fitting",
        href: `/r/${args.slug}/appointments`,
        enabled: true,
      },
      ...(args.candidate.productId
        ? [
            {
              kind: "buy" as const,
              label: "Reorder this piece",
              href: `/r/${args.slug}/products/${args.candidate.productId}`,
              enabled: false,
              reason: "Open the catalogue product to choose a variant",
            },
          ]
        : []),
    ];
  }

  return [
    {
      kind: "save",
      label: "Save",
      enabled: args.candidate.available,
      ...(args.candidate.available
        ? {}
        : { reason: "Not currently available" }),
    },
    {
      kind: "review",
      label: "Review in store",
      href: `/r/${args.slug}/products/${args.candidate.slug}`,
      enabled: args.candidate.available,
    },
    {
      kind: "book",
      label: "Book a fitting",
      href: `/r/${args.slug}/appointments`,
      enabled: true,
    },
    {
      kind: "buy",
      label: "Buy",
      href: `/r/${args.slug}/products/${args.candidate.slug}`,
      enabled: args.candidate.available,
    },
  ];
}

function pickBestForSlot(
  candidates: readonly MorningRoutineCandidate[],
  slotKind: OutfitSlotKind,
): MorningRoutineCandidate | null {
  const slotCandidates = candidates.filter(
    (candidate) => candidate.slotKind === slotKind,
  );
  if (slotCandidates.length === 0) return null;
  return slotCandidates.reduce((best, current) => {
    const bestOwned = best.kind === "owned_wardrobe" ? 1 : 0;
    const currentOwned = current.kind === "owned_wardrobe" ? 1 : 0;
    if (currentOwned !== bestOwned) {
      return currentOwned > bestOwned ? current : best;
    }
    if (current.available !== best.available) {
      return current.available ? current : best;
    }
    return best;
  });
}

export function selectMorningRoutineRecommendations(
  request: MorningRoutineSelectionRequest & { readonly slug: string },
): MorningRoutineSelectionResult {
  const maxRecommendations = request.maxRecommendations ?? 2;
  const personalizationUsed =
    mayCapturePersonalizationForCustomer(request.consent) &&
    request.styleProfile !== undefined;
  const locationUsed = request.provenance.some(
    (entry) => entry.input === "location" && entry.used,
  );

  const scored = [...request.wardrobe, ...request.catalogue].map(
    (candidate) => {
      const { score, factors } = scoreCandidate({
        candidate,
        consent: request.consent,
        ...(request.styleProfile ? { styleProfile: request.styleProfile } : {}),
        ...(request.styleConceptLabels
          ? { styleConceptLabels: request.styleConceptLabels }
          : {}),
        ...(request.weather !== undefined ? { weather: request.weather } : {}),
        ...(request.occasion !== undefined
          ? { occasion: request.occasion }
          : {}),
      });
      return {
        candidate,
        score,
        factors,
        actions: buildActions({ candidate, slug: request.slug }),
      };
    },
  );

  scored.sort((a, b) => b.score - a.score);

  const recommendations: MorningRoutineRecommendation[] = [];
  const usedCandidateKeys = new Set<string>();

  for (let index = 0; index < maxRecommendations; index += 1) {
    const lookItems: MorningRoutineRecommendationItem[] = [];
    for (const slotKind of CORE_SLOTS) {
      const bestOwned = scored.find(
        (entry) =>
          entry.candidate.slotKind === slotKind &&
          entry.candidate.kind === "owned_wardrobe" &&
          entry.candidate.available &&
          !usedCandidateKeys.has(candidateKey(entry.candidate)),
      );
      const bestCatalogue = scored.find(
        (entry) =>
          entry.candidate.slotKind === slotKind &&
          entry.candidate.kind === "catalogue_product" &&
          entry.candidate.available &&
          !usedCandidateKeys.has(candidateKey(entry.candidate)),
      );
      const chosenEntry =
        bestOwned ??
        bestCatalogue ??
        (() => {
          const fallback = pickBestForSlot(
            scored.map((entry) => entry.candidate),
            slotKind,
          );
          if (!fallback) return undefined;
          return scored.find(
            (entry) => candidateKey(entry.candidate) === candidateKey(fallback),
          );
        })();
      if (!chosenEntry) continue;
      usedCandidateKeys.add(candidateKey(chosenEntry.candidate));
      lookItems.push(chosenEntry);
    }

    if (lookItems.length === 0) break;

    const ownedCount = lookItems.filter(
      (item) => item.candidate.kind === "owned_wardrobe",
    ).length;
    const title =
      index === 0
        ? ownedCount >= 2
          ? "Wear what you own"
          : "Complete today's look"
        : `Alternative ${index + 1}`;
    const summary = buildRecommendationSummary({
      items: lookItems,
      ownedCount,
      ...(request.weather !== undefined ? { weather: request.weather } : {}),
      ...(request.occasion !== undefined ? { occasion: request.occasion } : {}),
    });
    const aggregateScore = lookItems.reduce((sum, item) => sum + item.score, 0);
    const aggregateFactors = dedupeFactors(
      lookItems.flatMap((item) => item.factors),
    );

    recommendations.push({
      title,
      summary,
      items: lookItems,
      score: aggregateScore,
      factors: aggregateFactors,
    });
  }

  if (recommendations.length === 0 && scored.length > 0) {
    const top = scored[0];
    if (top) {
      recommendations.push({
        title: "Start with this piece",
        summary: top.factors.map((factor) => factor.detail).join(" · "),
        items: [top],
        score: top.score,
        factors: top.factors,
      });
    }
  }

  return {
    recommendations,
    provenance: request.provenance,
    personalizationUsed,
    locationUsed,
  };
}

function candidateKey(candidate: MorningRoutineCandidate): string {
  return candidate.kind === "owned_wardrobe"
    ? `wardrobe:${candidate.wardrobeItemId}`
    : `catalogue:${candidate.productId}:${candidate.productVariantId}`;
}

function dedupeFactors(
  factors: readonly MorningRoutineScoreFactor[],
): MorningRoutineScoreFactor[] {
  const seen = new Set<string>();
  const result: MorningRoutineScoreFactor[] = [];
  for (const factor of factors) {
    const key = `${factor.code}:${factor.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(factor);
  }
  return result;
}

function buildRecommendationSummary(args: {
  readonly items: readonly MorningRoutineRecommendationItem[];
  readonly weather?: MorningRoutineWeatherSnapshot | null;
  readonly occasion?: MorningRoutineCalendarEvent | null;
  readonly ownedCount: number;
}): string {
  const parts: string[] = [];
  if (args.weather) {
    parts.push(
      `${args.weather.temperatureCelsius}°C ${args.weather.description}`,
    );
  }
  if (args.occasion) {
    parts.push(`for ${args.occasion.label}`);
  }
  if (args.ownedCount > 0) {
    parts.push(
      `${args.ownedCount} owned piece${args.ownedCount === 1 ? "" : "s"} lead this look`,
    );
  }
  const catalogueFill = args.items.filter(
    (item) => item.candidate.kind === "catalogue_product",
  ).length;
  if (catalogueFill > 0) {
    parts.push(
      `${catalogueFill} catalogue suggestion${catalogueFill === 1 ? "" : "s"} to complete gaps`,
    );
  }
  return parts.length > 0
    ? parts.join(" · ")
    : "A considered combination from your relationship with this house.";
}

export function appendStyleProfileProvenance(args: {
  readonly consent: CustomerConsentState;
  readonly styleProfile?: CustomerStyleProfile;
}): MorningRoutineInputProvenanceEntry {
  if (!mayCapturePersonalizationForCustomer(args.consent)) {
    return {
      input:
        args.consent.personalization.status === "withdrawn"
          ? "withdrawn"
          : "unavailable",
      used: false,
      detail: "StyleProfile inputs require personalization consent",
    };
  }
  if (!args.styleProfile) {
    return {
      input: "unavailable",
      used: false,
      detail: "No StyleProfile recorded yet",
    };
  }
  const declared = args.styleProfile.explicitPreferences.length;
  const inferred = args.styleProfile.inferredPreferences.length;
  return {
    input: declared > 0 ? "style_profile_declared" : "style_profile_inferred",
    used: declared + inferred > 0,
    detail: `${declared} declared and ${inferred} inferred preferences considered`,
  };
}

export function appendWardrobeProvenance(
  count: number,
): MorningRoutineInputProvenanceEntry {
  return {
    input: "wardrobe",
    used: count > 0,
    detail:
      count > 0
        ? `${count} owned garment${count === 1 ? "" : "s"} available`
        : "No owned garments available for routine selection",
  };
}

export function appendCatalogueProvenance(
  count: number,
): MorningRoutineInputProvenanceEntry {
  return {
    input: "catalogue",
    used: count > 0,
    detail:
      count > 0
        ? `${count} active catalogue candidate${count === 1 ? "" : "s"}`
        : "No active catalogue candidates",
  };
}
